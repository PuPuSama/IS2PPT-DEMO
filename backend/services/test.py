from flask import Flask

app = Flask(__name__)        # 创建一个 web 应用

@app.route('/hello')          # 当有人访问 /hello 这个网址
def hello():
    return "你好！"           # 就返回这句话

app.run(port=5011)            # 在 5011 端口跑起来