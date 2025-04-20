export const EXT_TO_LANG: { [key: string]: string } = {
  py: 'python',
  c: 'c',
  cpp: 'cpp',
  java: 'java',
  js: 'javascript',
  ts: 'typescript',
  html: 'html',
  css: 'css',
  xml: 'xml',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  sh: 'bash',
  rb: 'ruby'
};

// Common binary file extensions that should be skipped by default
export const BINARY_FILE_EXTENSIONS = [
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp', '.ico', '.svg',
  // Compiled binaries and executables
  '.exe', '.dll', '.so', '.dylib', '.bin', '.class', '.pyc',
  // Compressed files
  '.zip', '.gz', '.tar', '.rar', '.7z', '.bz2', '.xz',
  // Audio and video
  '.mp3', '.mp4', '.avi', '.mov', '.wav', '.ogg', '.flac', '.wmv', '.mkv',
  // Document formats
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pages', '.key', '.numbers',
  // Other binary formats
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  // Database files
  '.db', '.sqlite', '.mdb',
  // Disk images
  '.iso', '.dmg', '.img',
];
