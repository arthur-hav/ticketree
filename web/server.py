from quart import Quart, render_template, websocket, make_response, request, redirect
import requests
import yaml
from os import urandom
import base64
import importlib

app = Quart(__name__)
verify_cert = False
routes = yaml.safe_load(open('web/endpoints.yml'))


for route, methods_desc in routes['endpoints'].items():
    for description in methods_desc.values():
        for i, processor in enumerate(description['processors']):
            description['processors'][i] = importlib.import_module(processor)

    @app.route(route, methods=list(methods_desc.keys()))
    async def endpoint():
        jwt = request.cookies['auth']
        infos = {}
        for method, description in methods_desc.items():
            if method == request.method:
                for backend in description['backends']:
                    rq = requests.request(method, backend,
                                          headers={'Authorization': f'Bearer {jwt}'},
                                          verify=verify_cert)
                    infos.update(rq.json())
                for module in description['processors']:
                    infos = module.process(infos)
                if 'template' in description:
                    return await render_template(description['template'], **infos)
                return infos


@app.route('/tickets', methods=['GET'])
async def tickets():
    return await render_template('index.html')


@app.route('/users', methods=['GET'])
async def users():
    return await render_template('index.html')


@app.route("/login", methods=['GET', 'POST'])
async def hello():
    if request.method == 'GET':
        csrf = base64.b64encode(urandom(32)).decode('utf-8')
        context = {'csrf': csrf}
        resp = await make_response(await render_template("login.html", **context))
        resp.set_cookie('csrf', csrf, httponly=True, secure=True, samesite='Strict')
        return resp
    elif request.method == 'POST':
        cookie = request.cookies['csrf']
        form_data = await request.form
        if cookie != form_data['csrf']:
            return redirect('/', 302)
        login_test = requests.post('https://app:8181/token', data={'username': form_data['username'],
                                                                   'password': form_data['password']},
                                   verify=verify_cert)
        if login_test.status_code != 200:
            return redirect('/', 302)
        json_token = login_test.json()
        resp = redirect('/tickets', 302)
        resp.set_cookie('auth', json_token["access_token"], httponly=True, secure=True, samesite='Strict')
        return resp


@app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
async def backend_call(path):
    jwt = request.cookies['auth']
    r = requests.request(request.method,
                         f'https://app:8181/{path}',
                         headers={'Authorization': f'Bearer {jwt}'},
                         json=await request.json,
                         verify=verify_cert)
    return r.json()


# @app.websocket("/ws")
# async def ws():
#     while True:
#         await websocket.send("hello")
#         await websocket.send_json({"hello": "world"})

if __name__ == "__main__":
    app.run()
