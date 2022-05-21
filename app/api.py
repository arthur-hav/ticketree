from typing import Optional

from fastapi import FastAPI, WebSocket, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Optional
from psycopg2 import sql
from pydantic import SecretStr, BaseModel
from html import escape, unescape
from datetime import datetime, timedelta
from typing import Union
from jose import JWTError, jwt
from passlib.context import CryptContext
import json
import math
import asyncio
import random
import re
import os
import uuid

from .db_conn import Cursor


SECRET_KEY = os.environ.get("TCK_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440


class TokenData(BaseModel):
    username: Union[str, None] = None


class User(BaseModel):
    username: str
    id: uuid.UUID
    display_name: Union[str, None] = None
    is_admin: bool
    hashed_password: str


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
    parent_id: Optional[uuid.UUID]
    status: str


class NewFilter(BaseModel):
    expression: str


class NewUser(BaseModel):
    username: str
    display_name: str
    password: str
    is_admin: bool


class Filter(NewFilter):
    filter_id: uuid.UUID


class Ticket(NewTicket):
    ticket_id: uuid.UUID


def create_admin():
    superadmin = NewUser(username=os.environ.get('TCK_ADMIN_LOGIN'),
                      display_name='Super admin',
                      is_admin=True,
                      password=os.environ.get('TCK_ADMIN_PASSWORD'))
    cur = Cursor()
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
    def __init__(self, flter: str):
        self.tokens = []
        for tok_type, tok_re in FilterToken.types.items():
            for match in re.finditer(tok_re, flter):
                for prev_tok_type, prev_match in self.tokens:
                    if prev_match.start() <= match.start() < prev_match.end() \
                            or prev_match.start() < match.end() <= prev_match.end():
                        break
                else:
                    self.tokens.append((tok_type, match))
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


@app.get("/tickets/")
async def get_ticket(user: User = Depends(get_current_user)):
    if user.is_admin:
        acls = ['#true']
    else:
        cur = Cursor()
        query = sql.SQL("""
        SELECT filter.expression 
            FROM acl LEFT JOIN filter ON acl.filter = filter.id 
            WHERE action = 'READ' 
              AND object_type = 'ticket' 
              AND user_id = %s;
        """)
        cur.execute(query, (str(user.id),))
        acls = cur.fetchall()
    acl_filters = [FilterExpression(acl) for acl in acls]
    if not acl_filters:
        return {'tickets': [], 'success': True}
    cur = Cursor()
    query = sql.SQL("""
    SELECT id, title, type, description, assignee, organization, parent_id, status FROM ticket;
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
            parent_id=ticket_data[6],
            status=ticket_data[7]
        )
        if not all(acl_filter.evaluate(t) for acl_filter in acl_filters):
            continue
        ret_tickets.append(t)
    return {'tickets': ret_tickets, 'success': True}


@app.post("/tickets/")
async def post_ticket(ticket: NewTicket, user: User = Depends(get_current_user)):
    if user.is_admin:
        acls = ['#true']
    else:
        cur = Cursor()
        query = sql.SQL("""
        SELECT filter FROM acl WHERE action = 'READ' AND object_type = 'ticket' AND user_id = %s;
        """)
        cur.execute(query, (str(user.id),))
        acls = cur.fetchall()
    acl_filters = [FilterExpression(acl) for acl in acls]
    if not acl_filters:
        return {'success': False}
    if not all(acl_filter.evaluate(ticket) for acl_filter in acl_filters):
        return {'success': False}
    cur = Cursor()
    query = sql.SQL("""
    INSERT INTO ticket (id, owner_id, title, type, description, assignee, organization, parent_id, status) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
    """)
    cur.execute(query,
                (str(uuid.uuid4()),
                 str(user.id),
                 ticket.title,
                 ticket.ticket_type,
                 ticket.description,
                 str(ticket.assignee) if ticket.assignee else None,
                 str(ticket.organization) if ticket.organization else None,
                 str(ticket.parent_id) if ticket.parent_id else None,
                 ticket.status
                ))

    return {'success': True}


@app.put("/tickets/{ticket_id}")
async def put_ticket(ticket: NewTicket, ticket_id: uuid.UUID, user: User = Depends(get_current_user)):
    if user.is_admin:
        acls = ['#true']
    else:
        cur = Cursor()
        query = sql.SQL("""
        SELECT filter FROM acl WHERE action = 'READ' AND object_type = 'ticket' AND user_id = %s;
        """)
        cur.execute(query, (str(user.id),))
        acls = cur.fetchall()
    acl_filters = [FilterExpression(acl) for acl in acls]
    if not acl_filters:
        return {'success': False}
    if not all(acl_filter.evaluate(ticket) for acl_filter in acl_filters):
        return {'success': False}
    cur = Cursor()
    query = sql.SQL("""
    SELECT title, type, description, assignee, organization, parent_id, status FROM ticket WHERE id = %s;
    """)
    cur.execute(query, (str(ticket_id),))
    cur_ticket_data = cur.fetchone()
    cur_ticket = NewTicket(
        title=cur_ticket_data[0],
        ticket_type=cur_ticket_data[1],
        description=cur_ticket_data[2],
        assignee=uuid.UUID(cur_ticket_data[3]) if cur_ticket_data[3] else None,
        organization=uuid.UUID(cur_ticket_data[4]) if cur_ticket_data[4] else None,
        parent_id=uuid.UUID(cur_ticket_data[5]) if cur_ticket_data[5] else None,
        status=cur_ticket_data[6],
    )
    if not all(acl_filter.evaluate(cur_ticket) for acl_filter in acl_filters):
        return {'success': False}
    cur = Cursor()
    query = sql.SQL("""
    UPDATE ticket 
        SET title = %s, 
        type = %s,
        description = %s, 
        assignee = %s,
        organization = %s,
        parent_id = %s,
        status = %s
        WHERE id = %s
        ;""")
    cur.execute(query,
                (ticket.title,
                 ticket.ticket_type,
                 ticket.description,
                 str(ticket.assignee) if ticket.assignee else None,
                 str(ticket.organization) if ticket.organization else None,
                 str(ticket.parent_id) if ticket.parent_id else None,
                 ticket.status,
                 str(ticket_id)
                ))
    return {'success': cur.rowcount}


# FILTERS

@app.post("/filters/")
async def post_filter(filter: NewFilter, user: User = Depends(get_current_user)):
    cur = Cursor()
    query = sql.SQL("""
    INSERT INTO filter (id, owner_id, expression) 
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
        where = "owner_id = '{owner_id}'"
    cur = Cursor()
    query = sql.SQL(f"""
    UPDATE filter (id, owner_id, expression)
        SET expression = %s
        WHERE id = %s AND {where};
    """.format(owner_id=str(user.id)))
    cur.execute(query, (FilterExpression(filter.expression).store_str(), filter.filter_id))
    return {'success': True}


@app.get("/filters/")
async def get_filter(user: User = Depends(get_current_user)):
    if user.is_admin:
        where = 'TRUE'
    else:
        where = "owner_id = '{owner_id}'"
    cur = Cursor()
    query = sql.SQL(f"""
    SELECT (id, owner_id, expression) 
        FROM filter
        WHERE {where};
    """.format(owner_id=sql.Identifier(str(user.id))))
    cur.execute(query)
    return {'success': True, 'filters': cur.fetchall()}


@app.delete("/filters/{filter_id}")
async def delete_filter(filter_id: uuid.UUID, user: User = Depends(get_current_user)):
    if user.is_admin:
        where = 'TRUE'
    else:
        where = "owner_id = '{owner_id}'"
    cur = Cursor()
    query = sql.SQL(f"""
    DELETE
        FROM filter
        WHERE id = %s AND {where};
    """.format(owner_id=sql.Identifier(str(user.id))))
    cur.execute(query, (filter_id,))
    return {'success': True, 'filters': cur.fetchall()}


# PROFILE

@app.get("/profile")
async def get_me(user: User = Depends(get_current_user)):
    cur = Cursor()
    query = sql.SQL(f"""
    SELECT (username) 
        FROM profiles
        WHERE id = %s;
    """)
    cur.execute(query, (str(user.id),))
    return {'username': cur.fetchone()}


@app.put("/profile")
async def put_me(user_data: NewUser, user: User = Depends(get_current_user)):
    cur = Cursor()
    query = sql.SQL(f"""
    UPDATE profiles 
        SET username = %s 
        WHERE id = %s;
    """)
    cur.execute(query, (user_data.username, str(user.id),))
    return {'success': True}


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
    cur.execute(query, (uuid.uuid4(),
                        user_data.username,
                        user_data.is_admin,
                        user_data.display_name,
                        get_password_hash(user_data.password)))
    return {'success': True}


@app.put("/profiles/{user_id}")
async def put_profile(user_id: uuid.UUID,
                      user_data: NewUser,
                      user: User = Depends(get_current_user)):
    if not user.is_admin:
        raise credentials_exception
    cur = Cursor()
    query = sql.SQL(f"""
    UPDATE profiles 
        SET display_name = %s 
        WHERE id = %s;
    """)
    cur.execute(query, (user_data.username, user_id,))
    return {'success': True}


@app.get("/profiles/{user_id}")
async def get_profile(user_id: uuid.UUID, user: User = Depends(get_current_user)):
    if not user.is_admin:
        raise credentials_exception
    cur = Cursor()
    query = sql.SQL(f"""
    SELECT (username) 
        FROM profiles
        WHERE id = %s;
    """)
    cur.execute(query, (user_id,))
    return {'username': cur.fetchone()}


@app.get("/profiles")
async def list_profiles(user: User = Depends(get_current_user)):
    if not user.is_admin:
        raise credentials_exception
    cur = Cursor()
    query = sql.SQL(f"""
    SELECT (id, username) 
        FROM profiles;
    """)
    cur.execute(query)
    return {'profiles': cur.fetchall()}


# ACL

@app.get("/acl")
async def get_acl(user: User = Depends(get_current_user)):
    if not user.is_admin:
        raise credentials_exception
    cur = Cursor()
    query = sql.SQL(f"""
    SELECT (username) 
        FROM profiles
        WHERE id = %s;
    """)
    cur.execute(query, (str(user.id),))
    return {'username': cur.fetchone()}


@app.post("/acl")
async def post_acl(user: User = Depends(get_current_user)):
    if not user.is_admin:
        raise credentials_exception
    cur = Cursor()

    return {'success': True, 'id': str(user.id)}


@app.put("/acl")
async def put_acl(user: User = Depends(get_current_user)):
    if not user.is_admin:
        raise credentials_exception
    cur = Cursor()
    query = sql.SQL(f"""
    UPDATE profiles 
        SET username = %s 
        WHERE id = %s;
    """)
    cur.execute(query, (user.username, str(user.id),))
    return {'success': True}


@app.websocket('/ws')
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    start = datetime.utcnow()
    rand = 0
    while True:
        then = datetime.utcnow() + datetime.timedelta(seconds=0.5)
        data = []
        while start < then:
            rand = max(min(rand + (random.random() - 0.5) * 0.2, 1), - 1)
            data.append([math.cos(start.timestamp()),
                          math.sin(start.timestamp()),
                          rand])
            start += datetime.timedelta(milliseconds=100)
        await websocket.send_text(json.dumps({'data': data}))
        await asyncio.sleep(0.5)
