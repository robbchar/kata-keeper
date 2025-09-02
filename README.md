# kata-keeper

- logging: https://console.cloud.google.com/logs/query;cursorTimestamp=2025-09-02T20:56:53.415648Z;duration=PT1H?authuser=0&project=robbchar-3db11

# problems / solutions

- I had a hard time getting functions to work, here are some things I did:
- made certain everything was in the same region (us-west1 for this)
- had to enable a gcloud iam policy for the endpoitn with:

```gcloud run services add-iam-policy-binding previewkata \
  --project=robbchar-3db11 \
  --region=us-west1 \
  --member=allUsers \
  --role=roles/run.invoker
```

- had to create a db for the function (not strictly necessary but prob wise for logging in general)

# handy commands

- `gcloud config set project robbchar-3db11` (or whatever project)
- `gcloud run services list --region=us-west1` (or whatever region)
- start firebase emulators `firebase emulators:start --only functions,firestore` (or whatever services)
- deploy firebase function `firebase deploy --only functions:previewKata` (or whatever function)
