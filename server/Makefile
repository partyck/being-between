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

.PHONY: run docker videos deploy gcp

# local server, on HTTPS when server/certs has the certificates
run:
	cd src && python3 main.py

# the same container as Cloud Run, on http://localhost:8080 (Chrome allows the camera and Web Serial on localhost)
docker:
	docker build -t $(SERVICE) src
	docker run --rm -p 8080:8080 -v "$(CURDIR)/src/static/videos:/app/static/videos:ro" $(SERVICE)

# uploads src/static/videos to a public Cloud Storage bucket. Run it again when the videos change.
videos: gcp
	$(GCLOUD) storage buckets describe gs://$(BUCKET) >/dev/null 2>&1 || \
		$(GCLOUD) storage buckets create gs://$(BUCKET) --location=$(REGION) --uniform-bucket-level-access
	$(GCLOUD) storage buckets add-iam-policy-binding gs://$(BUCKET) --member=allUsers --role=roles/storage.objectViewer
	$(GCLOUD) storage rsync src/static/videos gs://$(BUCKET)

# one instance only: the Socket.IO rooms live in memory. 1 vCPU, because less than that allows only one connection.
# --timeout=3600 is the longest Cloud Run keeps a WebSocket open.
deploy: gcp
	$(GCLOUD) run deploy $(SERVICE) --region=$(REGION) --source=src \
		--allow-unauthenticated --cpu=1 --memory=512Mi --min-instances=1 --max-instances=1 --timeout=3600 \
		--set-env-vars=VIDEOS_URL=$(VIDEOS_URL)

gcp:
	@test -n "$(PROJECT)" || { echo "No GCP project: set PROJECT at the top of the Makefile or pass PROJECT=<id>"; exit 1; }
