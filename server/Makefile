# Run from server/. Override any variable on the command line, e.g. `make deploy SERVICE=being-between-test`.
# gcloud runs with its own configuration (your private Google account) and an explicit project, never the active ones.
GCLOUD_CONFIG ?= being-between
PROJECT ?= being-between-510716
# europe-west1, because Cloud Run domain mappings (being-between.porpatrick.com) only exist in some regions
REGION ?= europe-west1
SERVICE ?= being-between
BUCKET ?= $(PROJECT)-videos
VIDEOS_URL ?= https://storage.googleapis.com/$(BUCKET)
# the Secret Manager secret with the installation key of the deployed server (README)
SECRET ?= installation-key
GCLOUD = gcloud --configuration=$(GCLOUD_CONFIG) --project=$(PROJECT)

# The installation key of the local server, as INSTALLATION_KEY=<key> in server/.env (gitignored, README). The server
# only accepts clients that open /?deviceid=1 or 2 with &key=<key>. Without the file, `run` and `docker` accept any
# client with a device id. The deployed server takes its key from Secret Manager instead (`make secret`).
-include .env
export INSTALLATION_KEY

.PHONY: run docker videos secret key new-key deploy gcp

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

# one time: creates the installation key secret with a random key, and lets the service account Cloud Run runs as (the
# Compute Engine default one) read it. Running it again changes nothing. The project number comes from the secret's name
# (projects/<number>/secrets/<name>): `gcloud projects describe` counts against a quota every gcloud user shares.
secret: gcp
	$(GCLOUD) services enable secretmanager.googleapis.com
	$(GCLOUD) secrets describe $(SECRET) >/dev/null 2>&1 || \
		openssl rand -hex 16 | tr -d '\n' | $(GCLOUD) secrets create $(SECRET) --replication-policy=automatic --data-file=-
	number=$$($(GCLOUD) secrets describe $(SECRET) --format='value(name)' | cut -d/ -f2); test -n "$$number" && \
	$(GCLOUD) secrets add-iam-policy-binding $(SECRET) --role=roles/secretmanager.secretAccessor \
		--member=serviceAccount:$$number-compute@developer.gserviceaccount.com

# prints the deployed installation key, for the installations' URLs
key: gcp
	@$(GCLOUD) secrets versions access latest --secret=$(SECRET); echo

# replaces the installation key with a new random one. It takes effect at the next `make deploy`.
new-key: gcp
	openssl rand -hex 16 | tr -d '\n' | $(GCLOUD) secrets versions add $(SECRET) --data-file=-

# one instance only: the Socket.IO rooms live in memory. 1 vCPU, because less than that allows only one connection.
# --timeout=3600 is the longest Cloud Run keeps a WebSocket open.
# Cloud Run reads the key from Secret Manager into $INSTALLATION_KEY when an instance starts. The deploy pins the
# secret's current version, so a `make new-key` can't change the key when Cloud Run restarts the instance on its own.
deploy: gcp
	version=$$($(GCLOUD) secrets versions describe latest --secret=$(SECRET) --format='value(name.basename())') || \
		{ echo "No installation key in Secret Manager: run make secret (README)"; exit 1; }; \
	$(GCLOUD) run deploy $(SERVICE) --region=$(REGION) --source=src \
		--allow-unauthenticated --cpu=1 --memory=512Mi --min-instances=1 --max-instances=1 --timeout=3600 \
		--set-env-vars=VIDEOS_URL=$(VIDEOS_URL) \
		--set-secrets=INSTALLATION_KEY=$(SECRET):$$version

gcp:
	@test -n "$(PROJECT)" || { echo "No GCP project: set PROJECT at the top of the Makefile or pass PROJECT=<id>"; exit 1; }
