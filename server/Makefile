# Run from server/. Override any variable on the command line, e.g. `make deploy SERVICE=being-between-test`.
# gcloud runs with its own configuration (your private Google account) and an explicit project, never the active ones.
GCLOUD_CONFIG ?= being-between
PROJECT ?= being-between-510716
# europe-west1, because Cloud Run domain mappings (being-between.porpatrick.com) only exist in some regions
REGION ?= europe-west1
SERVICE ?= being-between
BUCKET ?= $(PROJECT)-videos
VIDEOS_URL ?= https://storage.googleapis.com/$(BUCKET)
GCLOUD = gcloud --configuration=$(GCLOUD_CONFIG) --project=$(PROJECT)

# The installation key, as INSTALLATION_KEY=<key> in server/.env (gitignored, README). The server only accepts clients
# that open /?deviceid=1 or 2 with &key=<key>. Without the file, `run` and `docker` accept any client with a device id.
-include .env
export INSTALLATION_KEY

.PHONY: run docker videos deploy gcp

# local server, on HTTPS when server/certs has the certificates
run:
	cd src && python3 main.py

# the same container as Cloud Run, on http://localhost:8080 (Chrome allows the camera and Web Serial on localhost)
docker:
	docker build -t $(SERVICE) src
	docker run --rm -p 8080:8080 -e INSTALLATION_KEY -v "$(CURDIR)/src/static/videos:/app/static/videos:ro" $(SERVICE)

# uploads src/static/videos to a public Cloud Storage bucket. Run it again when the videos change.
videos: gcp
	$(GCLOUD) storage buckets describe gs://$(BUCKET) >/dev/null 2>&1 || \
		$(GCLOUD) storage buckets create gs://$(BUCKET) --location=$(REGION) --uniform-bucket-level-access
	$(GCLOUD) storage buckets add-iam-policy-binding gs://$(BUCKET) --member=allUsers --role=roles/storage.objectViewer
	$(GCLOUD) storage rsync src/static/videos gs://$(BUCKET)

# one instance only: the Socket.IO rooms live in memory. 1 vCPU, because less than that allows only one connection.
# --timeout=3600 is the longest Cloud Run keeps a WebSocket open.
# The key comes from the shell ($INSTALLATION_KEY), so make doesn't print it.
deploy: gcp
	@test -n "$$INSTALLATION_KEY" || { echo "No installation key: create server/.env (README)"; exit 1; }
	$(GCLOUD) run deploy $(SERVICE) --region=$(REGION) --source=src \
		--allow-unauthenticated --cpu=1 --memory=512Mi --min-instances=1 --max-instances=1 --timeout=3600 \
		--set-env-vars=VIDEOS_URL=$(VIDEOS_URL),INSTALLATION_KEY=$$INSTALLATION_KEY

gcp:
	@test -n "$(PROJECT)" || { echo "No GCP project: set PROJECT at the top of the Makefile or pass PROJECT=<id>"; exit 1; }
