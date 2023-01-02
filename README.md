# YouTube-DWL
- Download any quality video 
- Video + Audio | Video and audio will be merged together

# Help for console
- url: Link to youtube video     | Needed parameter     | Example: https://youtu.be/g_Nf2S6JbOY
- AudioType: Type file           | Default: mp3         | Example: mp4
- NeedVideo: Quality             | Default: AudioOnly   | Example: 1080p

# How to start
- Need FFmpeg and Node.js >=17 version
- Typescript >= 4.9 version

1. Build project
   - run build.bat
   - or tsc -p tsconfig.json
2. Running project
   - run run.bat
   - or cd build && node -r tsconfig-paths/register src/dwl.js
