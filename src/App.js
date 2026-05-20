import { useState, useEffect, useRef } from "react";

// Fallback to empty string if environment variable isn't configured yet
const apiKey = process.env.REACT_APP_GROQ_API_KEY || ""; 

// Prompt demands a JSON array of exactly 5 ultra-simple riddles at once
const SYSTEM_PROMPT = `You are a friendly riddlemaster for absolute beginners. Your job is to generate exactly 5 incredibly simple, easy, and obvious riddles at once.

Rules for each riddle text:
- Keep it strictly between 2 to 3 very short sentences.
- Use basic, every-day vocabulary only. No complex metaphors.
- The concept must be instantly recognizable (like a banana, a car, a dog, or a bed).

Rules for each hint:
- The hint must be a massive giveaway, making it so 85% of people instantly guess the exact word.
- Example for 'banana': "It is a yellow fruit that monkeys love to eat."

Generate the response as a JSON object containing a top-level array named "riddles" containing exactly 5 items. Each item must have these exact fields:
- "id": a number from 1 to 5
- "riddle": the riddle text (2-3 lines, ultra-simple and clear)
- "answer": the one-word or short answer
- "hint": an incredibly revealing hint that practically gives away the answer (85% certainty)
- "explanation": 1 short sentence explaining the logic simply in plain English

ONLY return valid JSON matching this structure, nothing else, no markdown backticks`;

const RATING_PROMPT = `You are a riddlemaster judging a player's answer. Given the riddle, correct answer, and player's guess, respond with JSON:
- "correct": boolean (true if player's answer matches or is close enough)
- "verdict": a short dramatic 3-6 word verdict phrase (e.g. "The Oracle smiles upon you!", "Darkness clouds your vision.")
- "score": 0 (wrong) or 1 (correct)
Only return valid JSON, no markdown.`;

const DIFFICULTIES = ["Easy", "Medium", "Hard", "Fiendish"];
const CATEGORIES = ["Nature", "Objects", "Animals", "Abstract", "Words", "Numbers", "Time", "Mythology"];

const stars = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 0.5,
  delay: Math.random() * 4,
  dur: Math.random() * 3 + 2,
}));

async function callGroq(systemPrompt, userMessage) {
  if (!apiKey) {
    console.error("Groq API key is missing. Check your environment variables.");
    throw new Error("Missing API Key");
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: 2000,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "{}";
}

export default function App() {
  // Login State
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Game States
  const [difficulty, setDifficulty] = useState("Medium");
  const [category, setCategory] = useState("Nature");
  
  // Storage altered to handle multiple batch items cleanly
  const [riddleBatch, setRiddleBatch] = useState([]); 
  const [loading, setLoading] = useState(false);
  
  // NEW: Track which specific riddle in the 5-item batch is currently active
  const [currentRiddleIndex, setCurrentRiddleIndex] = useState(0);
  
  // Track inputs, states, hints, and feedback across all 5 items locally
  const [guesses, setGuesses] = useState({ 0: "", 1: "", 2: "", 3: "", 4: "" });
  const [hintsShown, setHintsShown] = useState({ 0: false, 1: false, 2: false, 3: false, 4: false });
  const [verdicts, setVerdicts] = useState({ 0: null, 1: null, 2: null, 3: null, 4: null });
  const [surrendered, setSurrendered] = useState({ 0: false, 1: false, 2: false, 3: false, 4: false });
  
  const [judging, setJudging] = useState(false);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState("setup");
  const [fadeIn, setFadeIn] = useState(false);
  const inputRef = useRef(null);

  // --- INVENTORY & MAGICAL ARTIFACTS STATES ---
  const [inventory, setInventory] = useState(["📜 Scroll of Wisdom"]);

  // --- SOUND FX AUDIO TOGGLE STATE ---
  const [soundEnabled, setSoundEnabled] = useState(true);

  // --- THE SANDS OF TIME COUNTDOWN STATES ---
  const [timeLeft, setTimeLeft] = useState(45);
  const timerRef = useRef(null);

  // --- MULTI-STEP QUESTS STATES ---
  const [questMode, setQuestMode] = useState(false);
  const [questStage, setQuestStage] = useState(1);
  const QUEST_CATEGORIES = ["Nature", "Objects", "Time", "Mythology"];

  // --- MOCK LEADERBOARD HALL OF FAME ---
  const [leaderboard, setLeaderboard] = useState([
    { name: "Merlin_42", score: 12, mastery: 92 },
    { name: "GandalfTheWise", score: 10, mastery: 83 },
    { name: "Devika", score: 5, mastery: 71 },
    { name: "ChamberNovice", score: 1, mastery: 25 }
  ]);

  // Audio Synth System
  const playMysticSound = (type) => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "summon") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
      } else if (type === "correct") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        osc.start(); osc.stop(ctx.currentTime + 0.5);
      } else if (type === "wrong" || type === "timeout") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      console.warn("Audio blocked:", e);
    }
  };

  // Timer Effect handles structural ticks down per individual active riddle card
  useEffect(() => {
    if (phase === "riddle" && riddleBatch.length > 0) {
      const baseTime = difficulty === "Easy" ? 120 : difficulty === "Medium" ? 90 : difficulty === "Hard" ? 60 : 45;
      setTimeLeft(baseTime);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [riddleBatch, phase, currentRiddleIndex]);

  const handleTimeout = () => {
    playMysticSound("timeout");
    setVerdicts(prev => ({
      ...prev,
      [currentRiddleIndex]: { correct: false, verdict: "Timeout!", score: 0 }
    }));
  };

  useEffect(() => {
    if (phase === "riddle" && riddleBatch.length > 0) {
      setFadeIn(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setFadeIn(true)));
    }
  }, [riddleBatch, phase, currentRiddleIndex]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setAuthError("Fill in all scrolls to proceed.");
      return;
    }
    
    setUser({ name: username.trim() });
    setAuthError("");
    
    setLeaderboard(prev => {
      if (prev.some(entry => entry.name.toLowerCase() === username.trim().toLowerCase())) return prev;
      return [...prev, { name: username.trim(), score: 0, mastery: 0 }];
    });
  };

  const handleGoogleLogin = () => {
    setUser({ name: "Google Seer" });
    setAuthError("");
    setLeaderboard(prev => [...prev, { name: "Google Seer", score: 0, mastery: 0 }]);
  };

  const handleLogout = () => {
    setUser(null);
    setUsername("");
    setPassword("");
    setPhase("setup");
    setRiddleBatch([]);
    setQuestMode(false);
    setQuestStage(1);
  };

  async function generateRiddle() {
    if (timerRef.current) clearInterval(timerRef.current);
    playMysticSound("summon");
    setLoading(true);
    setPhase("riddle");
    setRiddleBatch([]);
    setCurrentRiddleIndex(0);
    setGuesses({ 0: "", 1: "", 2: "", 3: "", 4: "" });
    setHintsShown({ 0: false, 1: false, 2: false, 3: false, 4: false });
    setVerdicts({ 0: null, 1: null, 2: null, 3: null, 4: null });
    setSurrendered({ 0: false, 1: false, 2: false, 3: false, 4: false });

    const activeCategory = questMode ? QUEST_CATEGORIES[questStage - 1] : category;

    try {
      const text = await callGroq(SYSTEM_PROMPT, `Generate 5 separate simple riddles for difficulty ${difficulty} in category ${activeCategory}.`);
      const parsed = JSON.parse(text.trim());
      const elements = parsed.riddles || [];
      setRiddleBatch(elements);
      setTotal(t => t + elements.length);
    } catch (error) {
      console.warn("Falling back to default riddles:", error);
      const elements = [
        { riddle: "I am a yellow fruit. Monkeys love to eat me. What am I?", answer: "Banana", hint: "Yellow fruit you peel.", explanation: "Monkeys love bananas." },
        { riddle: "I bark and wag my tail. I am known as man's best friend. What am I?", answer: "Dog", hint: "A common household barking pet.", explanation: "Dogs wag tails and bark." },
        { riddle: "I shine bright in the night sky and change shapes. What am I?", answer: "Moon", hint: "It circles the Earth at night.", explanation: "The moon lights up the night sky." },
        { riddle: "I have keys but open no locks. I have space but no room. What am I?", answer: "Keyboard", hint: "You type on it right now.", explanation: "Computer keyboards have typing keys." },
        { riddle: "I am completely round, look bright orange, and grow on trees. What am I?", answer: "Orange", hint: "It shares its name with a color.", explanation: "Oranges are round citrus fruits." }
      ];
      setRiddleBatch(elements);
      setTotal(t => t + elements.length);
    }
    setLoading(false);
  }

  async function submitSingleGuess(index) {
    const targetGuess = guesses[index];
    const currentRiddle = riddleBatch[index];
    if (!targetGuess.trim() || judging) return;

    setJudging(true);
    try {
      const text = await callGroq(
        RATING_PROMPT,
        `Riddle: "${currentRiddle.riddle}"\nCorrect answer: "${currentRiddle.answer}"\nPlayer's guess: "${targetGuess}"`
      );
      const result = JSON.parse(text.trim());
      
      setVerdicts(prev => ({ ...prev, [index]: result }));
      
      if (result.correct) {
        playMysticSound("correct");
        setScore(s => {
          const newScore = s + 1;
          updateLiveLeaderboard(newScore, total);
          awardInventoryItems(newScore, difficulty);
          return newScore;
        });
      } else {
        playMysticSound("wrong");
      }
    } catch {
      const correct = targetGuess.toLowerCase().trim() === currentRiddle.answer.toLowerCase().trim();
      const fallbackVerdict = { correct, verdict: correct ? "The Oracle smiles upon you!" : "The fates have spoken.", score: correct ? 1 : 0 };
      
      setVerdicts(prev => ({ ...prev, [index]: fallbackVerdict }));
      if (correct) {
        playMysticSound("correct");
        setScore(s => {
          const newScore = s + 1;
          updateLiveLeaderboard(newScore, total);
          awardInventoryItems(newScore, difficulty);
          return newScore;
        });
      } else {
        playMysticSound("wrong");
      }
    }
    setJudging(false);
  }

  // Handle advancing down individual sequence steps or completing the batch entirely
  const advanceSequenceIndex = () => {
    if (currentRiddleIndex < 4) {
      setCurrentRiddleIndex(prev => prev + 1);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (questMode) {
        const totalCorrectInBatch = Object.values(verdicts).filter(v => v && v.correct).length;
        if (totalCorrectInBatch >= 3 && questStage < 4) {
          setQuestStage(qs => qs + 1);
        }
      }
      setPhase("result");
    }
  };

  const updateLiveLeaderboard = (currentScore, totalRiddles) => {
    const activeTotal = totalRiddles === 0 ? 1 : totalRiddles;
    setLeaderboard(prev => 
      prev.map(player => 
        player.name === user?.name 
          ? { ...player, score: currentScore, mastery: Math.round((currentScore / activeTotal) * 100) }
          : player
      )
    );
  };

  const awardInventoryItems = (currentScore, currentDiff) => {
    setInventory(prev => {
      const items = [...prev];
      if (currentScore >= 2 && !items.includes("🔮 Oracle's Eye")) items.push("🔮 Oracle's Eye");
      if (currentScore >= 4 && !items.includes("🧪 Elixir of Clarity")) items.push("🧪 Elixir of Clarity");
      return items;
    });
  };

  function revealSingleAnswer(index) {
    setSurrendered(prev => ({ ...prev, [index]: true }));
    setVerdicts(prev => ({ ...prev, [index]: { correct: false, verdict: "Wisdom shared freely.", score: 0 } }));
  }

  const isRiddleViewActive = (phase === "riddle" || phase === "result") && riddleBatch.length > 0;
  const currentRiddleItem = riddleBatch[currentRiddleIndex];

  return (
    <div style={{
      minHeight: "100vh", background: "#0d0a14",
      fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
      color: "#e8dfc8", position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      {/* Starfield */}
      <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
        {stars.map(s => (
          <circle key={s.id} cx={`${s.x}%`} cy={`${s.y}%`} r={s.size} fill="#c8b8f0" opacity="0.6">
            <animate attributeName="opacity" values="0.2;0.8;0.2" dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>

      {/* Nebula blobs */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "10%", left: "5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(80,40,120,0.18) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "15%", right: "5%", width: 500, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(40,80,100,0.15) 0%, transparent 70%)" }} />
      </div>

      {/* Header */}
      <header style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "36px 24px 0", display: isRiddleViewActive ? "none" : "block" }}>
        <div style={{ position: "absolute", top: 20, right: 25, zIndex: 10 }}>
          <button onClick={() => setSoundEnabled(!soundEnabled)} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(180,140,255,0.2)", padding: "6px 12px", color: "#c8b0f0", cursor: "pointer", fontSize: 12, borderRadius: 20 }}>
            {soundEnabled ? "🔊 Sound: On" : "🔇 Sound: Off"}
          </button>
        </div>
        <div style={{ fontSize: 11, letterSpacing: "0.35em", color: "#9070c0", textTransform: "uppercase", marginBottom: 8 }}>✦ The Chamber of Enigmas ✦</div>
        <h1 style={{ margin: 0, fontSize: "clamp(32px, 6vw, 52px)", fontWeight: "normal", color: "#f0e6c8", textShadow: "0 0 40px rgba(180,140,255,0.4)", letterSpacing: "0.04em" }}>Riddle Me This</h1>
        {user && <div style={{ marginTop: 10, fontSize: 14, color: "#b5a4d4", letterSpacing: "0.05em" }}>Welcome, <span style={{ color: "#f0e6c8", fontStyle: "italic" }}>{user.name}</span> ✦</div>}
        {user && total > 0 && (
          <div style={{ marginTop: 6, fontSize: 13, color: "#7a6a9a", letterSpacing: "0.1em" }}>
            {score} / {total} solved &nbsp;·&nbsp;
            <span style={{ color: score / total >= 0.7 ? "#88c88a" : "#c89070" }}>
              {Math.round((score / total) * 100)}% mastery
            </span>
          </div>
        )}
      </header>

      {!user ? (
        /* LOGIN PORTAL VIEW */
        <main style={{ flex: 1, position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", maxWidth: 420, margin: "0 auto", width: "100%" }}>
          <form onSubmit={handleLogin} style={{ background: "linear-gradient(145deg, rgba(40,28,55,0.95), rgba(25,18,40,0.98))", border: "1px solid rgba(180,140,255,0.2)", borderRadius: 2, padding: "40px 30px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)", position: "relative" }}>
            {["topleft","topright","bottomleft","bottomright"].map(pos => (
              <div key={pos} style={{ position: "absolute", top: pos.includes("top") ? 10 : "auto", bottom: pos.includes("bottom") ? 10 : "auto", left: pos.includes("left") ? 10 : "auto", right: pos.includes("right") ? 10 : "auto", color: "rgba(140,100,200,0.3)", fontSize: 16 }}>✦</div>
            ))}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔑</div>
              <h2 style={{ fontSize: 20, fontWeight: "normal", color: "#f0e6c8", margin: 0, letterSpacing: "0.05em" }}>Identify Thyself</h2>
              <p style={{ fontSize: 12, color: "#7a6a9a", marginTop: 6 }}>Enter credentials to open the gate</p>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9070c0", marginBottom: 8 }}>Seer Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter any username..." style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(180,140,255,0.2)", color: "#e8dfc8", padding: "11px 16px", borderRadius: 4, fontSize: 14, fontFamily: "Palatino Linotype, serif", outline: "none", letterSpacing: "0.04em" }} />
            </div>
            <div style={{ marginBottom: 24, position: "relative" }}>
              <label style={{ display: "block", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9070c0", marginBottom: 8 }}>Secret Passcode</label>
              <div style={{ position: "relative" }}>
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(180,140,255,0.2)", color: "#e8dfc8", padding: "11px 45px 11px 16px", borderRadius: 4, fontSize: 14, fontFamily: "Palatino Linotype, serif", outline: "none", letterSpacing: "0.04em" }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "#7a6a9a", cursor: "pointer", fontSize: "16px", userSelect: "none" }}>{showPassword ? "👁️" : "🙈"}</button>
              </div>
            </div>
            {authError && <div style={{ color: "#c89070", fontSize: 13, textAlign: "center", marginBottom: 16, fontStyle: "italic" }}>🔮 {authError}</div>}
            <button type="submit" style={{ width: "100%", background: "linear-gradient(135deg, rgba(100,50,160,0.8), rgba(60,30,100,0.9))", border: "1px solid rgba(180,120,255,0.4)", color: "#e0d0ff", padding: "13px", borderRadius: 4, cursor: "pointer", fontSize: 14, fontFamily: "inherit", letterSpacing: "0.12em", textTransform: "uppercase", boxShadow: "0 0 30px rgba(140,80,200,0.25)", transition: "all 0.3s" }}>Unlock Chamber</button>
            <div style={{ display: "flex", alignItems: "center", textTransform: "uppercase", fontSize: 10, color: "#4a3a60", letterSpacing: "0.2em", margin: "20px 0" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(180,140,255,0.15)" }} />
              <span style={{ padding: "0 10px" }}>OR</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(180,140,255,0.15)" }} />
            </div>
            <button type="button" onClick={handleGoogleLogin} style={{ width: "100%", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.15)", color: "#e8dfc8", padding: "11px", borderRadius: 4, cursor: "pointer", fontSize: 13, fontFamily: "inherit", letterSpacing: "0.06em", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", transition: "all 0.3s" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" style={{ display: "block" }}>
                <path fill="#EA4335" d="M12 5.04c1.64 0 3.12.56 4.28 1.67l3.2-3.2C17.52 1.58 14.96 1 12 1 7.35 1 3.42 3.67 1.51 7.56l3.76 2.92C6.16 7.37 8.87 5.04 12 5.04z"/>
                <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.46h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.97 3.38-4.88 3.38-8.5z"/>
                <path fill="#FBBC05" d="M5.27 14.42c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.51 6.92C.55 8.87 0 11.05 0 13.33s.55 4.46 1.51 6.41l3.76-2.92z"/>
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.66-2.84c-1.01.68-2.31 1.08-3.96 1.08-3.13 0-5.84-2.33-6.79-5.44l-3.76 2.92C3.42 20.33 7.35 23 12 23z"/>
              </svg>
              Continue with Google
            </button>
          </form>
        </main>
      ) : (
        /* CORE GAME LOOP VIEW */
        <main style={{ flex: 1, position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 20px 40px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
          
          {/* Dashboard Setup Config */}
          <div style={{ display: isRiddleViewActive ? "none" : "flex", gap: "24px", width: "100%", alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* LEFT COLUMN: INVENTORY */}
            <div style={{ flex: "1 1 200px", background: "rgba(25, 18, 40, 0.6)", border: "1px solid rgba(144, 112, 192, 0.15)", borderRadius: 4, padding: "16px", minHeight: "180px" }}>
              <div style={{ fontSize: 12, color: "#9070c0", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12, borderBottom: "1px solid rgba(144, 112, 192, 0.2)", paddingBottom: "4px" }}>🎒 Mystic Satchel</div>
              {inventory.map((item, index) => (
                <div key={index} style={{ fontSize: 13, color: "#e8dfc8", margin: "8px 0", background: "rgba(255,255,255,0.02)", padding: "6px 10px", borderRadius: 4, borderLeft: "2px solid #6a5080" }}>{item}</div>
              ))}
            </div>

            {/* MIDDLE COLUMN: ACTIVE CONFIG SETUP */}
            <div style={{ flex: "2 1 440px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
                <button onClick={() => { setQuestMode(false); setPhase("setup"); setRiddleBatch([]); }} style={{ background: !questMode ? "rgba(140,80,200,0.2)" : "rgba(0,0,0,0.2)", border: `1px solid ${!questMode ? "#b48ce0" : "rgba(255,255,255,0.1)"}`, padding: "6px 16px", borderRadius: 4, color: "#e8dfc8", fontSize: 12, cursor: "pointer" }}>🔮 Casual Play</button>
                <button onClick={() => { setQuestMode(true); setPhase("setup"); setRiddleBatch([]); setQuestStage(1); }} style={{ background: questMode ? "rgba(212,176,255,0.15)" : "rgba(0,0,0,0.2)", border: `1px solid ${questMode ? "#d4b0ff" : "rgba(255,255,255,0.1)"}`, padding: "6px 16px", borderRadius: 4, color: "#d4b0ff", fontSize: 12, cursor: "pointer" }}>📜 Trial of Elements Quest</button>
              </div>

              {!questMode ? (
                <div style={{ width: "100%", marginBottom: 20 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", justifyContent: "center" }}>
                    {DIFFICULTIES.map(d => (
                      <button key={d} onClick={() => setDifficulty(d)} style={{ background: difficulty === d ? "rgba(140,80,200,0.25)" : "rgba(255,255,255,0.04)", border: difficulty === d ? "1px solid rgba(180,120,255,0.6)" : "1px solid rgba(255,255,255,0.1)", color: difficulty === d ? "#d4b0ff" : "#7a6a9a", padding: "7px 18px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontFamily: "inherit", letterSpacing: "0.06em", transition: "all 0.2s" }}>{d}</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                    {CATEGORIES.map(c => (
                      <button key={c} onClick={() => setCategory(c)} style={{ background: category === c ? "rgba(80,140,160,0.2)" : "rgba(255,255,255,0.03)", border: category === c ? "1px solid rgba(100,180,200,0.5)" : "1px solid rgba(255,255,255,0.07)", color: category === c ? "#90d0e0" : "#5a5070", padding: "5px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontFamily: "inherit", letterSpacing: "0.04em", transition: "all 0.2s" }}>{c}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ background: "rgba(40,25,60,0.4)", border: "1px solid rgba(180,140,255,0.2)", borderRadius: 4, padding: "12px", width: "100%", marginBottom: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: "#b48ce0", letterSpacing: "0.1em", marginBottom: 8 }}>Active Campaign Stage</div>
                  <div style={{ display: "flex", justifyContent: "space-between", maxWidth: 360, margin: "0 auto", position: "relative" }}>
                    {QUEST_CATEGORIES.map((qCat, i) => (
                      <div key={i} style={{ zIndex: 2, fontSize: 12, color: (questStage === i + 1) ? "#f0e6c8" : (questStage > i + 1) ? "#88c88a" : "#4a3a60" }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: (questStage === i + 1) ? "#6432a0" : (questStage > i + 1) ? "#3b6b43" : "#1a1226", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(180,140,255,0.3)", margin: "0 auto 4px" }}>{questStage > i + 1 ? "✓" : i + 1}</div>
                        {qCat}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={generateRiddle} disabled={loading} style={{ background: loading ? "rgba(80,40,120,0.3)" : "linear-gradient(135deg, rgba(100,50,160,0.8), rgba(60,30,100,0.9))", border: "1px solid rgba(180,120,255,0.4)", color: loading ? "#7a6090" : "#e0d0ff", padding: "14px 40px", borderRadius: 4, cursor: loading ? "not-allowed" : "pointer", fontSize: 15, fontFamily: "inherit", letterSpacing: "0.12em", textTransform: "uppercase", boxShadow: loading ? "none" : "0 0 30px rgba(140,80,200,0.25)", transition: "all 0.3s", marginBottom: 24 }}>
                ✦ Summon 5 Riddles ✦
              </button>
              
              <button onClick={handleLogout} style={{ background: "transparent", border: "none", color: "#7a6a9a", cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>Leave Chamber</button>
            </div>

            {/* RIGHT COLUMN: LEADERBOARD */}
            <div style={{ flex: "1 1 240px", background: "rgba(25, 18, 40, 0.6)", border: "1px solid rgba(144, 112, 192, 0.15)", borderRadius: 4, padding: "16px" }}>
              <div style={{ fontSize: 12, color: "#9070c0", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12, borderBottom: "1px solid rgba(144, 112, 192, 0.2)", paddingBottom: "4px" }}>🏆 Hall of Fame</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {leaderboard.sort((a, b) => b.score - a.score).map((leader, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", background: leader.name === user?.name ? "rgba(144, 112, 192, 0.15)" : "transparent", borderRadius: 4, border: leader.name === user?.name ? "1px solid rgba(180,140,255,0.3)" : "none" }}>
                    <span style={{ fontSize: 13, color: leader.name === user?.name ? "#f0e6c8" : "#b5a4d4" }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "▪"} {leader.name}</span>
                    <span style={{ fontSize: 12, color: "#7a6a9a" }}>{leader.score} pts ({leader.mastery}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Loading Animation */}
          {loading && (
            <div style={{ textAlign: "center", color: "#6a5080", fontSize: 14, letterSpacing: "0.08em", margin: "40px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 12, animation: "spin 3s linear infinite", display: "inline-block" }}>🔮</div>
              <div>The riddles stir in the mist…</div>
            </div>
          )}

          {/* EXCLUSIVE 5-RIDDLES BATCH ROOM FOCUS VIEW SECTION */}
          {isRiddleViewActive && (
            <div style={{ width: "100%", maxWidth: "600px", margin: "40px auto 0", opacity: fadeIn ? 1 : 0, transform: fadeIn ? "translateY(0) scale(1)" : "translateY(20px) scale(0.98)", transition: "opacity 0.6s ease, transform 0.6s ease" }}>
              
              {/* Active Playing Mode Layout (Served One-by-One) */}
              {phase === "riddle" && currentRiddleItem && (
                <div>
                  {/* Central Single-Riddle Timer */}
                  <div style={{ marginBottom: 20, width: "100%", textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: timeLeft <= 15 ? "#c89070" : "#7a6a9a", letterSpacing: "0.1em" }}>
                      ⏳ TRIAL TIME REMAINING: <span style={{ fontSize: 15, fontWeight: "bold", color: timeLeft <= 15 ? "#ff8a65" : "#e8dfc8" }}>{timeLeft}s</span>
                    </div>
                    <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(timeLeft / (difficulty === "Easy" ? 120 : difficulty === "Medium" ? 90 : difficulty === "Hard" ? 60 : 45)) * 100}%`, background: timeLeft <= 15 ? "#ff8a65" : "#9070c0", transition: "width 1s linear" }} />
                    </div>
                  </div>

                  {/* Single Enigma Card Component rendering the active index item */}
                  <div style={{ background: "linear-gradient(145deg, rgba(40,28,55,0.95), rgba(25,18,40,0.98))", border: "1px solid rgba(180,140,255,0.2)", borderRadius: 2, padding: "36px 36px 28px", position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", marginBottom: "24px" }}>
                    
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, letterSpacing: "0.15em", color: "#9070c0", textTransform: "uppercase", marginBottom: 14 }}>
                      <span>✦ Trial Enigma #{currentRiddleIndex + 1} ({category}) ✦</span>
                      <span style={{ color: "#b48ce0" }}>{currentRiddleIndex + 1} / 5</span>
                    </div>
                    
                    <p style={{ margin: "0 0 24px 0", fontSize: "clamp(16px, 4vw, 20px)", lineHeight: "1.6", color: "#f0e6c8", fontStyle: "italic", letterSpacing: "0.02em" }}>
                      "{currentRiddleItem.riddle}"
                    </p>

                    {!verdicts[currentRiddleIndex] && (
                      <div>
                        {/* Hint Sub-System */}
                        <div style={{ minHeight: 40, marginBottom: 20 }}>
                          {!hintsShown[currentRiddleIndex] ? (
                            <button onClick={() => setHintsShown(p => ({ ...p, [currentRiddleIndex]: true }))} style={{ background: "transparent", border: "none", color: "#9070c0", cursor: "pointer", fontSize: 12, fontFamily: "inherit", letterSpacing: "0.05em", textTransform: "uppercase", padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
                              <span>🕯️ Summon a Hint</span>
                            </button>
                          ) : (
                            <div style={{ fontSize: 13, color: "#b5a4d4", lineHeight: "1.5", fontStyle: "italic", animation: "fadeIn 0.4s ease" }}>
                              <span style={{ color: "#9070c0", fontStyle: "normal" }}>Hint:</span> {currentRiddleItem.hint}
                            </div>
                          )}
                        </div>

                        {/* Input Actions Layout Wrapper */}
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <input
                            type="text"
                            ref={inputRef}
                            value={guesses[currentRiddleIndex] || ""}
                            onChange={e => setGuesses(p => ({ ...p, [currentRiddleIndex]: e.target.value }))}
                            placeholder="Cast your answer guess..."
                            style={{ flex: 1, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(180,140,255,0.15)", color: "#e8dfc8", padding: "12px 16px", borderRadius: 2, fontSize: 14, fontFamily: "inherit", outline: "none" }}
                          />
                          <button onClick={() => submitSingleGuess(currentRiddleIndex)} disabled={judging} style={{ background: "linear-gradient(135deg, rgba(100,50,160,0.7), rgba(60,30,100,0.8))", border: "1px solid rgba(180,120,255,0.3)", color: "#e0d0ff", padding: "12px 24px", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontSize: 12, letterSpacing: "0.1em" }}>Submit</button>
                        </div>

                        <div style={{ marginTop: 14, textAlign: "left" }}>
                          <button onClick={() => revealSingleAnswer(currentRiddleIndex)} style={{ background: "transparent", border: "none", color: "#5a4f7c", cursor: "pointer", fontSize: 11, fontStyle: "italic", textDecoration: "underline" }}>Surrender this trial</button>
                        </div>
                      </div>
                    )}

                    {/* Feedback with a 'Next Riddle' or 'Complete Batch' control button */}
                    {verdicts[currentRiddleIndex] && (
                      <div style={{ animation: "fadeIn 0.4s ease" }}>
                        <div style={{ padding: "16px", background: verdicts[currentRiddleIndex].correct ? "rgba(45,70,55,0.4)" : "rgba(70,45,45,0.4)", border: `1px solid ${verdicts[currentRiddleIndex].correct ? "rgba(100,200,120,0.25)" : "rgba(200,100,100,0.25)"}`, borderRadius: 2, marginBottom: 20 }}>
                          <div style={{ fontSize: 14, fontWeight: "bold", color: verdicts[currentRiddleIndex].correct ? "#a5d6a7" : "#ef9a9a", marginBottom: 4 }}>
                            {verdicts[currentRiddleIndex].correct ? "✨ Correct" : "❌ Trial Settled"} · <span style={{ fontWeight: "normal", fontStyle: "italic", fontSize: 12 }}>{verdicts[currentRiddleIndex].verdict}</span>
                          </div>
                          <div style={{ fontSize: 13, color: "#e8dfc8" }}>The correct word was: <strong style={{ color: "#f0e6c8", textTransform: "uppercase" }}>{currentRiddleItem.answer}</strong></div>
                          <div style={{ fontSize: 12, color: "#7a6a9a", marginTop: 4 }}>{currentRiddleItem.explanation}</div>
                        </div>

                        <button onClick={advanceSequenceIndex} style={{ width: "100%", background: "linear-gradient(135deg, rgba(120,60,180,0.8), rgba(80,40,120,0.9))", border: "1px solid rgba(180,140,255,0.4)", color: "#e0d0ff", padding: "14px 20px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 13 }}>
                          {currentRiddleIndex < 4 ? "Advance to Next Enigma ✦" : "Lock In & View Final Score Summary ✦"}
                        </button>
                      </div>
                    )}

                  </div>
                </div>
              )}

              {/* FINAL SCORE BATCH SUMMARY PANEL (Triggered after the 5th riddle journey concludes) */}
              {phase === "result" && (
                <div style={{ textAlign: "center", padding: "40px 30px", background: "linear-gradient(145deg, rgba(40,28,55,0.95), rgba(25,18,40,0.98))", border: "1px solid rgba(180,140,255,0.25)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", borderRadius: 2 }}>
                  <h3 style={{ color: "#f0e6c8", fontWeight: "normal", marginBottom: 8, fontSize: 22, letterSpacing: "0.05em" }}>🏆 Batch Campaign Concluded</h3>
                  <p style={{ fontSize: 14, color: "#9070c0", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 24 }}>Final Score Breakdown Summary</p>
                  
                  {/* Performance scoring loop breakdown list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", textAlign: "left", marginBottom: 32, background: "rgba(0,0,0,0.15)", padding: "16px", borderRadius: 4, border: "1px solid rgba(144, 112, 192, 0.1)" }}>
                    {riddleBatch.map((item, idx) => {
                      const correct = verdicts[idx]?.correct;
                      return (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: idx < 4 ? "10px" : "0", borderBottom: idx < 4 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                          <span style={{ fontSize: 13, color: "#b5a4d4" }}>Enigma #{idx + 1}: <span style={{ fontStyle: "italic", color: "#7a6a9a" }}>"{item.answer}"</span></span>
                          <span style={{ fontSize: 13, fontWeight: "bold", color: correct ? "#88c88a" : "#c89070" }}>
                            {correct ? "+1 Point" : "0 Points"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <p style={{ fontSize: 26, color: "#d4b0ff", marginBottom: 8, fontWeight: "bold" }}>
                    Total Score: {Object.values(verdicts).filter(v => v && v.correct).length} / 5 Points
                  </p>
                  <p style={{ fontSize: 13, color: "#7a6a9a", marginBottom: 32 }}>Overall profile cumulative milestones stand at {score} items successfully solved across history.</p>
                  
                  <button onClick={() => setPhase("setup")} style={{ background: "linear-gradient(135deg, rgba(100,50,160,0.8), rgba(60,30,100,0.9))", border: "1px solid rgba(180,120,255,0.4)", color: "#e0d0ff", padding: "12px 32px", cursor: "pointer", fontSize: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Return to Main Dashboard
                  </button>
                </div>
              )}

            </div>
          )}

        </main>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button:hover:not(:disabled) { filter: brightness(1.15); }
        input::placeholder { color: #5a4a70; }
      `}</style>
    </div>
  );
}