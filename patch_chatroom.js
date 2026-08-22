import fs from 'fs';

let content = fs.readFileSync('frontend/src/components/ChatRoom.jsx', 'utf8');

// Remove states
content = content.replace(/const \[imageUnlocked, setImageUnlocked\] = useState\(false\);\n/, '');
content = content.replace(/const \[showAdModal, setShowAdModal\] = useState\(false\);\n/, '');
content = content.replace(/const \[adTimer, setAdTimer\] = useState\(5\);\n/, '');
content = content.replace(/const \[isAdPlaying, setIsAdPlaying\] = useState\(false\);\n/, '');

// Fix handleImageClick
content = content.replace(
/const handleImageClick = \(\) => \{\n    if \(!imageUnlocked\) \{\n      setShowAdModal\(true\);\n    \} else \{\n      fileInputRef\.current\?\.click\(\);\n    \}\n  \};/,
`const handleImageClick = () => {
    fileInputRef.current?.click();
  };`
);

// Remove handlePlayAd
content = content.replace(/const handlePlayAd = \(\) => \{[\s\S]*?\}, 1000\);\n  \};\n/, '');

// Fix Image Button UI
content = content.replace(/className=\{`p-3\.5 rounded-2xl flex items-center justify-center shrink-0 transition-all \$\{imageUnlocked \? 'bg-zinc-800 text-pink-400 hover:bg-zinc-700' : 'bg-zinc-800\/50 text-zinc-500 hover:bg-zinc-800'\}`\}/g, `className="p-3.5 rounded-2xl flex items-center justify-center shrink-0 transition-all bg-zinc-800 text-pink-400 hover:bg-zinc-700"`);
content = content.replace(/title=\{imageUnlocked \? "Upload Image" : "Watch Ad to Unlock Images"\}/g, `title="Upload Image"`);

// Remove Ad Modal UI
content = content.replace(/\{showAdModal && \([\s\S]*?\}\)/, '');

fs.writeFileSync('frontend/src/components/ChatRoom.jsx', content);
