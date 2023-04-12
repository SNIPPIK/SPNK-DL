# SPNK-DL
- Download any quality video 
- Supported: Video+Audio, OnlyAudio
- The uploaded video will be saved in C:/User/Download/SPNK

# Help for console
- url: Link to youtube video   | Needed parameter     | Example: https://youtu.be/g_Nf2S6JbOY
- format: Type file            | Default: mp3         | Example: mp4
- quality: Quality             | Default: AudioOnly   | Example: 1080p

# How to start
- Need FFmpeg and Node.js >=17
- Typescript >= 4.9

1. Build project or download release build
   - execute build.bat
   - or tsc -p tsconfig.json
2. Running project
   - execute run.bat
   - or cd build && node -r tsconfig-paths/register src/dwl.js