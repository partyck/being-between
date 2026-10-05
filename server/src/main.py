import os

from flask import Flask, Response, json, redirect, request
from flask_socketio import SocketIO, emit, join_room, leave_room

app = Flask(__name__, static_url_path="")
app.config["SECRET_KEY"] = "secret!"

socketio = SocketIO(app, cors_allowed_origins="*")

# Cloud Run can't send responses over 32 MiB, so there the videos come from a Cloud Storage bucket (`make videos`).
VIDEOS_URL = os.environ.get("VIDEOS_URL", "").rstrip("/")
CERTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "certs")

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


# --- Installation sockets ---
# each web app reads its own esp32 over Web Serial and only shares these events with the other one.


@socketio.on("start")
def on_start(data):
    print("start ", data["deviceId"])
    socketio.emit("start", data)


@socketio.on("experience-started")
def on_experience_started(data):
    print("experience-started ", data["deviceId"])
    socketio.emit("experience-started", data)


@socketio.on("beat")
def on_beat(data):
    print("Beat from:", data["deviceId"])
    socketio.emit("motor", data)


# --- Fake experience videos ---
@app.route("/videos/<filename>")
def video(filename):
    if VIDEOS_URL:
        return redirect(f"{VIDEOS_URL}/{filename}")
    return app.send_static_file(f"videos/{filename}")


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
    debug = os.environ.get("DEBUG", "1") == "1"
    # The camera and Web Serial need HTTPS, so locally it uses the self-signed certificates in server/certs.
    # Cloud Run has none: it handles HTTPS itself and forwards plain HTTP to the container.
    keyfile = os.path.join(CERTS_DIR, "key.pem")
    certfile = os.path.join(CERTS_DIR, "cert.pem")
    ssl = {"keyfile": keyfile, "certfile": certfile} if os.path.exists(keyfile) and os.path.exists(certfile) else {}
    print(f"Server running on {'https' if ssl else 'http'}://0.0.0.0:{port}, debug {debug}")
    socketio.run(app, debug=debug, port=port, host="0.0.0.0", **ssl)
