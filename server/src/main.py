import os

from flask import Flask, Response, json, request
from flask_socketio import SocketIO, emit, join_room, leave_room

app = Flask(__name__, static_url_path="")
app.config["SECRET_KEY"] = "secret!"

socketio = SocketIO(app, cors_allowed_origins="*")

# MAIN_ROOM = "main-room"
DEVICE_SID_1 = ""
DEVICE_SID_2 = ""


# SOCKETS
@socketio.on("connect")
def on_connect():
    print("on_connect", request.sid)  # type: ignore


@socketio.on("disconnect")
def on_disconnect():
    """Handles user disconnection and cleans up their state."""
    sid = request.sid  # type: ignore
    print(f"client disconnected {sid}")


# --- WebRTC Signaling Handlers (Targeted) ---


@socketio.on("join")
def on_join(data):
    """A client joins a room."""
    print("on join")
    room = data["room"]
    join_room(room)
    emit("peer_joined", {"sid": request.sid}, to=room, skip_sid=request.sid)  # type: ignore


@socketio.on("leave")
def on_leave(data):
    """A client leaves a room."""
    print("on leave")
    room = data["room"]
    leave_room(room)
    emit("peer_left", {"sid": request.sid}, to=room, skip_sid=request.sid)  # type: ignore


@socketio.on("signal")
def on_signal(data):
    print("on signal")
    emit("signal", data, to=data["room"], skip_sid=request.sid)  # type: ignore


# --- Esp32 sockets ---


@socketio.on("start-beat")
def on_start_beat(data):
    print("Start beat from:", data["deviceId"])
    socketio.emit("start-beat", data)


@socketio.on("stop-beat")
def on_stop_beat(data):
    print("Stop beat from:", data["deviceId"])
    socketio.emit("stop-beat", data)


@socketio.on("beat")
def on_beat(data):
    print("Beat from:", data["deviceId"])
    socketio.emit("motor", data)


# --- Default Route to Serve index.html ---
@app.route("/")
def index():
    device_id = request.args.get("deviceid")
    if device_id:
        return app.send_static_file("index.html")
    else:
        error = {"error_description": 'please provide a device id "/?deviceid=1" or "/?deviceid=2"'}
        return Response(response=json.dumps(error), status=400, mimetype="application/json")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"Server running on port {port}")
    socketio.run(app, debug=True, port=port, host="0.0.0.0", keyfile="certs/key.pem", certfile="certs/cert.pem")
    # socketio.run(app, debug=True, port=port, host="0.0.0.0")
