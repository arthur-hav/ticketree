import os
import psycopg2
import time


class MetaCursor(type):
    __instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in MetaCursor.__instances:
            while True:
                try:
                    conn = psycopg2.connect(host=os.environ.get("TCK_DB_HOST"),
                                            user=os.environ.get("TCK_DB_LOGIN"),
                                            password=os.environ.get("TCK_DB_PASSWORD"))
                    MetaCursor.__instances[cls] = conn.cursor()
                    conn.autocommit = True
                    break
                except psycopg2.OperationalError:
                    time.sleep(1)
                    pass
        return MetaCursor.__instances[cls]


class Cursor(psycopg2._psycopg.cursor, metaclass=MetaCursor):
    pass
