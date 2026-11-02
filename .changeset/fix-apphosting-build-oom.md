---
"@pixerate/flair": patch
---

Skip `.dts` generation during Firebase App Hosting builds (`FIREBASE_APP_HOSTING=1` or `NO_DTS=1`) to prevent build worker out-of-memory errors.
