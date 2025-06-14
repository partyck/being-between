import json
import os

from flask import Flask, Response, request
from flask_socketio import SocketIO

app = Flask(__name__, static_url_path="")


socketio = SocketIO(app, cors_allowed_origins="*")


# SOCKETS
@socketio.on("connect")
def on_connect():
    print("on_connect", request.sid)


@socketio.on("disconnect")
def on_disconnect():
    print("on_disconnect", request.sid)


@socketio.on("beat")
def on_esp(data):
    print("Beat from:", data["deviceId"])
    socketio.emit("motor", data)


# ROUTES


@app.route("/")
def route_home():
    return Response(response=json.dumps({"message": "Success"}), status=200, mimetype="application/json")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    socketio.run(app, debug=True, port=port, host="0.0.0.0")
