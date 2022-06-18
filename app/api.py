from typing import Optional

from fastapi import FastAPI, WebSocket, Depends, HTTPException, status
from fastapi.responses import Response
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Optional
from psycopg2 import sql
from pydantic import SecretStr, BaseModel
from html import escape, unescape
from datetime import datetime, timedelta
from typing import Union, Tuple
from jose import JWTError, jwt
from passlib.context import CryptContext
import diskcache as dc
import re
import os
import io
import uuid
import base64

from .db_conn import Cursor
from .img_gen import pyvomit128

SECRET_KEY = os.environ.get("TCK_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440


class TokenData(BaseModel):
    username: Union[str, None] = None


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
app = FastAPI()
credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def get_user(username: str):
    cur = Cursor()
    query = """
    SELECT id, is_admin, display_name, pass_hash
        FROM profiles 
        WHERE username = %s"""
    cur.execute(query, (username,))
    if cur.rowcount:
        _id, admin, d_name, db_hash = cur.fetchone()
        return User(id=_id, username=username, is_admin=admin, display_name=d_name, hashed_password=db_hash)


def authenticate_user(username: str, password: str):
    user = get_user(username)
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user


def create_access_token(data: dict, expires_delta: Union[timedelta, None] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire.timestamp()})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        expire: int = payload.get("exp")
        if username is None or expire < datetime.utcnow().timestamp():
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = get_user(username=token_data.username)
    if user is None:
        raise credentials_exception
    return user


async def require_admin():
    user = await get_current_user()
    return user.is_admin


@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


class ConfigurationData(BaseModel):
    retention_interval: str
    compression_interval: str
    chunk_interval: str


class NewTicket(BaseModel):
    title: str
    ticket_type: str
    description: Optional[str]
    assignee: Optional[uuid.UUID]
    organization: Optional[uuid.UUID]
    parent: Optional[uuid.UUID]
    status: str


class NewFilter(BaseModel):
    expression: str


class NewUser(BaseModel):
    username: Optional[str]
    display_name: str
    password: Optional[str]
    is_admin: bool


class User(BaseModel):
    username: str
    id: uuid.UUID
    display_name: Optional[str]
    is_admin: bool
    hashed_password: str


class PutUser(BaseModel):
    username: Optional[str]
    display_name: str
    password: Optional[str]
    is_admin: bool


class Filter(NewFilter):
    filter_id: uuid.UUID


class Ticket(NewTicket):
    ticket_id: uuid.UUID
    owner: uuid.UUID


class NewOrg(BaseModel):
    display_name: str
    parent: Union[uuid.UUID, None]


class PermList(BaseModel):
    lst: Tuple[uuid.UUID, ...]
    is_organization_admin: bool


def create_admin():
    superadmin = NewUser(username=os.environ.get('TCK_ADMIN_LOGIN'),
                         display_name='Super admin',
                         is_admin=True,
                         password=os.environ.get('TCK_ADMIN_PASSWORD'))
    cur = Cursor()
    query = sql.SQL(f"""
    SELECT id FROM profiles WHERE is_admin
    """)
    cur.execute(query)
    if cur.rowcount > 0:
        return
    query = sql.SQL(f"""
    INSERT INTO profiles (id, username, is_admin, display_name, pass_hash)
        VALUES (%s, %s, %s, %s, %s) 
    """)
    cur.execute(query, (str(uuid.uuid4()),
                        superadmin.username,
                        superadmin.is_admin,
                        superadmin.display_name,
                        get_password_hash(superadmin.password)))


create_admin()


class FilterToken:
    types = {
        'sharp': '##',
        'quote': '#"',
        'and': r'#and',
        'or': r'#or',
        'not': r'#not',
        'eq': r'#eq',
        'in': r'#in',
        'gt': r'#gt',
        'lt': r'#lt',
        'me': r'#me',
        'pleft': r'#\(',
        'pright': r'#\)',
        'true': r'#true',
        'false': r'#false',
        'column': r'#([A-Za-z_]+)',
        'text': r'"([^"]+)"',
        'int': r'[0-9]+',
        'flt': r'[0-9]+\.[0-9]+',
    }


class FilterExpression:
    def __init__(self, user: uuid.UUID, flter: str):
        self.tokens = []
        for tok_type, tok_re in FilterToken.types.items():
            for match in re.finditer(tok_re, flter):
                for prev_tok_type, prev_match in self.tokens:
                    if prev_match.start() <= match.start() < prev_match.end() \
                            or prev_match.start() < match.end() <= prev_match.end():
                        break
                else:
                    self.tokens.append((tok_type, match))
        self.user_id = user
        self.tokens.sort(key=lambda it: it[1].start())

    def store_str(self):
        join_str = []
        for tok_type, tok_match in self.tokens:
            if tok_type == 'text':
                text = f'"{escape(tok_match.group(1))}"'
            else:
                text = tok_match.group(0)
            join_str.append(text)
        return ' '.join(join_str)

    def evaluate(self, obj, tokens=None):
        if tokens is None:
            tokens = self.tokens[:]
        tok = tokens.pop(0)
        if tok[0] == 'pleft':
            depth = 1
            acc = []
            while tokens:
                tok = tokens.pop(0)
                if tok[0] == 'pleft':
                    depth += 1
                if tok[0] == 'pright':
                    depth -= 1
                if depth == 0:
                    return self.eval_chain(obj, self.evaluate(obj, acc), tokens)
                acc.append(tok)
        if tok[0] == 'true':
            return self.eval_chain(obj, True, tokens)
        if tok[0] == 'false':
            return self.eval_chain(obj, False, tokens)
        if tok[0] == 'me':
            return self.eval_chain(obj, self.user_id, tokens)
        if tok[0] == 'not':
            return not self.evaluate(obj, tokens)
        if tok[0] == 'column':
            col_val = getattr(obj, tok[1].group(1))
            return self.eval_chain(obj, col_val, tokens)
        if tok[0] == 'text':
            return self.eval_chain(obj, tok[1].group(1).strip(), tokens)
        if tok[0] == 'flt':
            return self.eval_chain(obj, float(tok[1].group(0)), tokens)
        if tok[0] == 'int':
            return self.eval_chain(obj, int(tok[1].group(0)), tokens)
        if tok[0] == 'sharp':
            return '#' + self.evaluate(obj, tokens)
        if tok[0] == 'quote':
            return '"' + self.evaluate(obj, tokens)

    def eval_chain(self, obj, prev_val, tokens):
        if not tokens:
            return prev_val
        tok = tokens.pop(0)
        if tok[0] == 'sharp':
            return self.eval_chain(obj, prev_val + '#', tokens)
        if tok[0] == 'quote':
            return self.eval_chain(obj, prev_val + '"', tokens)
        if tok[0] == 'and':
            return prev_val and self.evaluate(obj, tokens)
        if tok[0] == 'or':
            return prev_val or self.evaluate(obj, tokens)
        if tok[0] == 'not':
            return not self.eval_chain(obj, prev_val, tokens)
        if tok[0] == 'eq':
            ret = self.evaluate(obj, tokens)
            return prev_val == ret
        if tok[0] == 'gt':
            ret = self.evaluate(obj, tokens)
            return prev_val >= ret
        if tok[0] == 'lt':
            ret = self.evaluate(obj, tokens)
            return prev_val <= ret
        if tok[0] == 'in':
            return prev_val in self.evaluate(obj, tokens)


async def org_list_from_user_id(user_id):
    cur = Cursor()
    organization_list = []
    query = sql.SQL("""
     SELECT organizations.id, organizations.parent, organizations.display_name
         FROM organizations INNER JOIN user_organization ON organizations.id = user_organization.organization_id 
         WHERE user_organization.user_id = %s;
     """)
    cur.execute(query, (str(user_id),))
    tree = cur.fetchall()
    while tree:
        org, parent, display_name = tree.pop()
        organization_list.append({'organization_id': org, 'parent': parent, 'display_name': display_name})
        if parent:
            query = sql.SQL("""
             SELECT organizations.parent, organizations.display_name
                 FROM organizations
                 WHERE id = %s;
             """)
            cur.execute(query, (str(parent),))
            parent_parent, display_name = cur.fetchone()
            tree.append((parent, parent_parent, display_name))
    return organization_list


@app.get("/tickets/")
async def get_ticket(user: User = Depends(get_current_user)):
    cur = Cursor()
    if not user.is_admin:
        organization_list = tuple(org['organization_id'] for org in await org_list_from_user_id(user.id))
        query = sql.SQL("""
        SELECT id, title, type, description, assignee, organization, parent, status, owner
            FROM ticket
            WHERE organization IN %s OR owner = %s;
        """)
        cur.execute(query, (organization_list or ("no-match",), str(user.id)))

    else:
        query = sql.SQL("""
        SELECT id, title, type, description, assignee, organization, parent, status, owner
            FROM ticket;
        """)
        cur.execute(query)
    ret_tickets = []
    for ticket_data in cur.fetchall():
        t = Ticket(
            ticket_id=ticket_data[0],
            title=ticket_data[1],
            ticket_type=ticket_data[2],
            description=ticket_data[3],
            assignee=ticket_data[4],
            organization=ticket_data[5],
            parent=ticket_data[6],
            status=ticket_data[7],
            owner=ticket_data[8]
        )
        ret_tickets.append(t)
    return {'tickets': ret_tickets, 'success': True}


@app.post("/tickets/")
async def post_ticket(ticket: NewTicket, user: User = Depends(get_current_user)):
    cur = Cursor()
    query = sql.SQL("""
    INSERT INTO ticket (id, owner, title, type, description, assignee, organization, parent, status) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
    """)
    new_uuid = uuid.uuid4()
    cur.execute(query,
                (str(new_uuid),
                 str(user.id),
                 ticket.title,
                 ticket.ticket_type,
                 ticket.description,
                 str(ticket.assignee) if ticket.assignee else None,
                 str(ticket.organization) if ticket.organization else None,
                 str(ticket.parent) if ticket.parent else None,
                 ticket.status
                 ))
    return {'success': True, 'ticket_id': new_uuid}


@app.put("/tickets/{ticket_id}")
async def put_ticket(ticket: NewTicket, ticket_id: uuid.UUID, user: User = Depends(get_current_user)):
    cur = Cursor()
    if not user.is_admin:
        query = sql.SQL("""
        SELECT owner, organization FROM ticket WHERE id = %s;
        """)
        cur.execute(query, (str(ticket_id),))
        cur_ticket_data = cur.fetchone()
        org_list = [str(org['organization_id']) for org in await org_list_from_user_id(user.id)]
        if cur_ticket_data[0] != str(user.id):
            if ticket.organization and str(ticket.organization) not in org_list:
                return {"success": False}
            if cur_ticket_data[1] not in org_list:
                return {'success': False}

    query = sql.SQL("""
    UPDATE ticket 
        SET title = %s, 
        type = %s,
        description = %s, 
        assignee = %s,
        organization = %s,
        parent = %s,
        status = %s
        WHERE id = %s
        ;""")
    cur.execute(query,
                (ticket.title,
                 ticket.ticket_type,
                 ticket.description,
                 str(ticket.assignee) if ticket.assignee else None,
                 str(ticket.organization) if ticket.organization else None,
                 str(ticket.parent) if ticket.parent else None,
                 ticket.status,
                 str(ticket_id)
                 ))
    return {'success': True}


# FILTERS

@app.post("/filters/")
async def post_filter(filter: NewFilter, user: User = Depends(get_current_user)):
    cur = Cursor()
    query = sql.SQL("""
    INSERT INTO filter (id, owner, expression) 
        VALUES (%s, %s, %s);
    """)
    cur.execute(query,
                (str(uuid.uuid4()),
                 str(user.id),
                 FilterExpression(filter.expression).store_str()
                 ))
    return {'success': True}


@app.put("/filters/")
async def put_filter(filter: Filter, user: User = Depends(get_current_user)):
    if user.is_admin:
        where = 'TRUE'
    else:
        where = "owner = '{owner}'"
    cur = Cursor()
    query = sql.SQL(f"""
    UPDATE filter (id, owner, expression)
        SET expression = %s
        WHERE id = %s AND {where};
    """.format(owner=str(user.id)))
    cur.execute(query, (FilterExpression(filter.expression).store_str(), filter.filter_id))
    return {'success': True}


@app.get("/filters/")
async def get_filter(user: User = Depends(get_current_user)):
    if user.is_admin:
        where = 'TRUE'
    else:
        where = "owner = '{owner}'"
    cur = Cursor()
    query = sql.SQL(f"""
    SELECT (id, owner, expression) 
        FROM filter
        WHERE {where};
    """.format(owner=sql.Identifier(str(user.id))))
    cur.execute(query)
    return {'success': True, 'filters': cur.fetchall()}


@app.delete("/filters/{filter_id}")
async def delete_filter(filter_id: uuid.UUID, user: User = Depends(get_current_user)):
    if user.is_admin:
        where = 'TRUE'
    else:
        where = "owner = '{owner}'"
    cur = Cursor()
    query = sql.SQL(f"""
    DELETE
        FROM filter
        WHERE id = %s AND {where};
    """.format(owner=sql.Identifier(str(user.id))))
    cur.execute(query, (filter_id,))
    return {'success': True, 'filters': cur.fetchall()}


# PROFILE

@app.get("/profile")
async def get_me(user: User = Depends(get_current_user)):
    org_list = await org_list_from_user_id(user.id)
    cur = Cursor()
    query = sql.SQL(f"""
    SELECT display_name 
        FROM profiles
        WHERE id = %s;
    """)
    cur.execute(query, (str(user.id),))
    return {'display_name': cur.fetchone(), 'user_id': user.id, 'org_list': org_list}


@app.delete("/profile/{user_id}")
async def delete_profile(user_id: uuid.UUID, user: User = Depends(get_current_user)):
    if not user.is_admin:
        raise credentials_exception
    cur = Cursor()
    query = sql.SQL(f"""
    DELETE profiles 
        WHERE id = %s;
    """)
    cur.execute(query, (user_id,))
    return {'success': True}


@app.post("/profile")
async def post_profile(user_data: NewUser,
                       user: User = Depends(get_current_user)):
    if not user.is_admin:
        raise credentials_exception
    cur = Cursor()
    query = sql.SQL(f"""
    INSERT INTO profiles (id, username, is_admin, display_name, pass_hash)
        VALUES (%s, %s, %s, %s, %s) 
    """)
    username = base64.encodebytes(os.urandom(32)).decode('utf-8')
    user_id = uuid.uuid4()
    cur.execute(query, (str(user_id),
                        username,
                        user_data.is_admin,
                        user_data.display_name,
                        get_password_hash(base64.encodebytes(os.urandom(32)).decode('utf-8'))))
    return {'success': True, 'user_id': user_id}


@app.put("/profiles/{user_id}")
async def put_profile(user_id: uuid.UUID,
                      user_data: PutUser,
                      user: User = Depends(get_current_user)):
    if user_id != user.id and not user.is_admin:
        raise credentials_exception
    cur = Cursor()
    query = sql.SQL("""
    UPDATE profiles 
        SET display_name = %s,
            is_admin = %s
        WHERE id = %s;
    """)
    cur.execute(query, (user_data.display_name, user_data.is_admin, str(user_id),))
    if user_data.password:
        query = sql.SQL("""
        UPDATE profiles 
            SET pass_hash = %s
            WHERE id = %s;
        """)
        cur.execute(query, (get_password_hash(user_data.password), str(user_id),))
    if user_data.username:
        query = sql.SQL("""
        UPDATE profiles 
            SET username = %s
            WHERE id = %s;
        """)
        cur.execute(query, (user_data.username, str(user_id),))
    return {'success': True}


@app.get("/profiles/{user_id}")
async def get_profile(user_id: uuid.UUID, user: User = Depends(get_current_user)):
    cur = Cursor()
    query = sql.SQL(f"""
    SELECT display_name
        FROM profiles
        WHERE id = %s;
    """)
    cur.execute(query, (user_id,))
    display_name, is_admin = cur.fetchone()
    return {'display_name': display_name, 'is_admin': is_admin}


@app.get("/profiles")
async def list_profiles(user: User = Depends(get_current_user)):
    cur = Cursor()
    query = sql.SQL(f"""
    SELECT id, display_name, is_admin
        FROM profiles
        ORDER BY id ASC;
    """)
    cur.execute(query)
    users = [{"user_id": user[0], "display_name": user[1], "is_admin": user[2]} for user in cur.fetchall()]
    return {'users': users}


# Organization


@app.delete("/organization/{org_id}")
async def delete_organization(org_id: uuid.UUID, user: User = Depends(get_current_user)):
    cur = Cursor()
    if not user.is_admin:
        query = sql.SQL("""
        SELECT organization_id FROM user_organization WHERE user_id = %s AND is_organization_admin;
        """)
        cur.execute(query, (user.id,))
        admin_from = set([row[0] for row in cur.fetchall()])
        if org_id not in admin_from:
            raise credentials_exception
    query = sql.SQL(f"""
    DELETE FROM organizations 
        WHERE id = %s;
    DELETE FROM user_organization
        WHERE organization_id = %s;
    """)
    cur.execute(query, (org_id, org_id,))
    return {'success': True}


@app.post("/organization")
async def post_organization(org: NewOrg, user: User = Depends(get_current_user)):
    if not user.is_admin:
        raise credentials_exception
    cur = Cursor()
    query = sql.SQL(f"""
    INSERT INTO organizations (id, display_name, parent)
        VALUES (%s, %s, %s) 
    """)
    organization_id = uuid.uuid4()
    cur.execute(query, (str(organization_id),
                        org.display_name,
                        str(org.parent) if org.parent else None))
    return {'success': True, 'organization_id': organization_id}


@app.put("/organization/{org_id}")
async def put_organization(org_id: uuid.UUID, org_data: NewOrg, user: User = Depends(get_current_user)):
    cur = Cursor()
    if not user.is_admin:
        query = sql.SQL("""
        SELECT organization_id FROM user_organization WHERE user_id = %s AND is_organization_admin;
        """)
        cur.execute(query, (user.id,))
        admin_from = set([row[0] for row in cur.fetchall()])
        if org_id not in admin_from:
            raise credentials_exception
    query = sql.SQL(f"""
    UPDATE organizations 
        SET display_name = %s,
            parent = %s
        WHERE id = %s;
    """)
    cur.execute(query, (org_data.display_name, str(org_data.parent) if org_data.parent else None, str(org_id),))
    return {'success': True}


@app.get("/organizations/{org_id}")
async def get_organization(org_id: uuid.UUID, user: User = Depends(get_current_user)):
    cur = Cursor()
    query = sql.SQL(f"""
    SELECT display_name, parent
        FROM organizations
        WHERE id = %s;
    """)
    cur.execute(query, (org_id,))
    display_name, parent = cur.fetchone()
    return {'display_name': display_name, 'parent': parent}


@app.get("/organizations")
async def list_organizations(user: User = Depends(get_current_user)):
    cur = Cursor()
    query = sql.SQL(f"""
    SELECT id, display_name, parent
        FROM organizations
        ORDER BY id ASC;
    """)
    cur.execute(query)
    orgs = [{"organization_id": org[0], "display_name": org[1], 'parent': org[2]} for org in cur.fetchall()]
    return {'organizations': orgs}


@app.get("/user_organization")
async def user_organization(user: User = Depends(get_current_user)):
    cur = Cursor()
    query = sql.SQL(f"""
    SELECT organization_id, user_id, is_organization_admin
        FROM user_organization
        ORDER BY organization_id, user_id;
    """)
    cur.execute(query)
    users = [{"organization_id": org_user[0], "user_id": org_user[1], "is_organization_admin": org_user[2]}
             for org_user in cur.fetchall()]
    return {'user_organization': users}


@app.put("/user_organization/{user_id}")
async def put_organization_list(organization_list: PermList, user_id: uuid.UUID,
                                user: User = Depends(get_current_user)):
    cur = Cursor()
    organization_list.lst = set([str(org) for org in organization_list.lst])
    if not user.is_admin:
        query = sql.SQL("""
        SELECT organization_id FROM user_organization WHERE user_id = %s AND is_organization_admin;
        """)
        cur.execute(query, (str(user.id),))
        admin_from = set([row[0] for row in cur.fetchall()])
        query = sql.SQL("""
        SELECT organization_id FROM user_organization WHERE user_id = %s AND is_organization_admin = %s;
        """)
        cur.execute(query, (str(user_id), organization_list.is_organization_admin))
        removed_orgs = set([row[0] for row in cur.fetchall()]) - organization_list.lst
        if not organization_list.lst.issubset(admin_from) or not removed_orgs.issubset(admin_from):
            raise credentials_exception
    query = sql.SQL("""
    DELETE FROM user_organization WHERE user_id = %s AND is_organization_admin = %s;
    """)
    cur.execute(query, (str(user_id), organization_list.is_organization_admin))

    if organization_list.lst:
        value_list = (tuple(str(user_id) for org in organization_list.lst),
                      tuple(str(org) for org in organization_list.lst),
                      tuple(organization_list.is_organization_admin for org in organization_list.lst))
        cur.execute("""
        INSERT INTO user_organization (user_id, organization_id, is_organization_admin) 
            VALUES %s;""", (value_list,))
    return {'success': True}


@app.put("/organization_user/{organization_id}")
async def put_user_list(user_list: PermList, organization_id: uuid.UUID, user: User = Depends(get_current_user)):
    cur = Cursor()
    if not user.is_admin:
        query = sql.SQL(f"""
        SELECT user_id FROM user_organization WHERE organization_id = %s AND user_id = %s AND is_organization_admin;
        """)
        cur.execute(query, (str(organization_id), str(user.id)))
        if not cur.rowcount:
            raise credentials_exception
    query = sql.SQL(f"""
    DELETE FROM user_organization WHERE organization_id = %s AND is_organization_admin = %s;
    """)
    cur.execute(query, (str(organization_id), user_list.is_organization_admin))
    user_list.lst = set(user_list.lst)
    if user_list.lst:
        value_list = (tuple(str(organization_id) for org in user_list.lst),
                      tuple(str(org) for org in user_list.lst),
                      tuple(user_list.is_organization_admin for org in user_list.lst))
        cur.execute("""
        INSERT INTO user_organization (organization_id, user_id, is_organization_admin) 
            VALUES %s;""", (value_list,))
    return {'success': True}


@app.get("/img/{uid}",
         responses={
             200: {
                 "content": {"image/png": {}}
             }
         },
         response_class=Response
)
async def get_uid_img(uid: uuid.UUID):
    cache = dc.Cache()
    if uid not in cache:
        img_byte_arr = io.BytesIO()
        pyvomit128(uid.int).save(img_byte_arr, format="PNG")
        cache[uid] = img_byte_arr.getvalue()
    return Response(cache[uid], media_type="image/png")
