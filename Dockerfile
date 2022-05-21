FROM tiangolo/uvicorn-gunicorn-fastapi:python3.9
WORKDIR /opt
COPY app/requirements.txt /opt/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /opt/requirements.txt
COPY ./app /opt/app
COPY ./certs /opt/certs