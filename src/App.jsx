import { useState, useEffect, useRef, useMemo } from "react";
import {
  Flame, Dumbbell, Calendar, UtensilsCrossed, Plus, Trash2, Camera,
  Check, Trophy, Shield, Crown, Gem, Zap, X, Loader2, RotateCcw,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from "recharts";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL = { mon: "จันทร์", tue: "อังคาร", wed: "พุธ", thu: "พฤหัสบดี", fri: "ศุกร์", sat: "เสาร์", sun: "อาทิตย์" };
const DOW_TO_KEY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const DEFAULT_SCHEDULE = {
  mon: ["วิดพื้น (Push-ups)", "Floor Press", "Dumbbell Overhead (Triceps)"],
  tue: ["DB Single Arm Row", "DB Row (พร้อมกัน 2 ข้าง)", "Bicep Curls (หน้าแขนแบบม้วน)"],
  wed: ["DB Shoulder Press", "DB Lateral Raise", "Squat", "DB RDL (พับสะโพกหลังขา)"],
  thu: ["วิดพื้น (Push-ups)", "Floor Press", "Dumbbell Overhead (Triceps)"],
  fri: ["DB Single Arm Row", "DB Row (พร้อมกัน 2 ข้าง)", "Bicep Curls (หน้าแขนแบบม้วน)"],
  sat: [],
  sun: [],
};

const ACHIEVEMENTS = [
  { id: "d3", days: 3, label: "จุดไฟติด", icon: Zap },
  { id: "d7", days: 7, label: "สัปดาห์เหล็ก", icon: Shield },
  { id: "d14", days: 14, label: "สองสัปดาห์แกร่ง", icon: Shield },
  { id: "d30", days: 30, label: "หนึ่งเดือนไม่มีหลุด", icon: Crown },
  { id: "d60", days: 60, label: "สองเดือนแห่งวินัย", icon: Gem },
  { id: "d100", days: 100, label: "ร้อยวันในตำนาน", icon: Trophy },
];

function pad(n) { return n.toString().padStart(2, "0"); }
function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayKeyStr() { return dateKey(new Date()); }
function isDayDone(entry) { return !!(entry && (entry.dayComplete || entry.restConfirmed)); }
function thaiDateLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function computeCurrentStreak(completed) {
  let count = 0;
  const cursor = new Date();
  if (!isDayDone(completed[dateKey(cursor)])) cursor.setDate(cursor.getDate() - 1);
  while (isDayDone(completed[dateKey(cursor)])) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay(); // 0 = Sun
}
const MONTH_NAMES = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

function buildHeatmap(completed, weeks = 13) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - weeks * 7 + 1);
  while (start.getDay() !== 0) start.setDate(start.getDate() - 1);
  const cols = [];
  const cursor = new Date(start);
  for (let w = 0; w < weeks + 1; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      col.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    cols.push(col);
  }
  return cols;
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

const ACTIVITY_LEVELS = [
  { id: "sedentary", label: "แทบไม่ขยับตัว (นั่งทำงานทั้งวัน)", mult: 1.2 },
  { id: "light", label: "ขยับเบาๆ (ออกกำลังกาย 1-3 วัน/สัปดาห์)", mult: 1.375 },
  { id: "moderate", label: "ปานกลาง (ออกกำลังกาย 3-5 วัน/สัปดาห์)", mult: 1.55 },
  { id: "active", label: "หนัก (ออกกำลังกาย 6-7 วัน/สัปดาห์)", mult: 1.725 },
  { id: "veryActive", label: "หนักมาก (ซ้อม 2 รอบ/วัน หรืองานใช้แรง)", mult: 1.9 },
];

function calcTDEE(profile) {
  const w = parseFloat(profile.weightKg);
  const h = parseFloat(profile.heightCm);
  const a = parseFloat(profile.age);
  if (!w || !h || !a) return null;
  const bmr = profile.gender === "female" ? 10 * w + 6.25 * h - 5 * a - 161 : 10 * w + 6.25 * h - 5 * a + 5;
  const mult = (ACTIVITY_LEVELS.find((l) => l.id === profile.activity) || ACTIVITY_LEVELS[2]).mult;
  return Math.round(bmr * mult);
}

const GOALS = [
  { id: "lose_fat", label: "ลดไขมัน", offset: -500, proteinPerKg: 2.2, fatPct: 0.3 },
  { id: "gain_muscle", label: "เพิ่มกล้ามเนื้อ", offset: 300, proteinPerKg: 2.0, fatPct: 0.25 },
  { id: "gain_weight", label: "เพิ่มน้ำหนัก", offset: 500, proteinPerKg: 1.8, fatPct: 0.25 },
  { id: "maintain", label: "รักษาน้ำหนัก", offset: 0, proteinPerKg: 1.6, fatPct: 0.28 },
  { id: "custom", label: "กำหนดเอง", offset: null, proteinPerKg: 2.0, fatPct: 0.27 },
];

function calcMacroPlan(tdee, profile) {
  if (!tdee) return null;
  const goal = GOALS.find((g) => g.id === profile.goal) || GOALS[3];
  const offset = goal.id === "custom" ? parseFloat(profile.customOffset) || 0 : goal.offset;
  const targetCalories = Math.max(1200, Math.round(tdee + offset));
  const w = parseFloat(profile.weightKg) || 0;
  const proteinPerKg = parseFloat(profile.customProteinPerKg) || goal.proteinPerKg;
  const proteinG = Math.round(w * proteinPerKg);
  const proteinKcal = proteinG * 4;
  const fatKcal = targetCalories * goal.fatPct;
  const fatG = Math.round(fatKcal / 9);
  const carbsKcal = Math.max(targetCalories - proteinKcal - fatKcal, 0);
  const carbsG = Math.round(carbsKcal / 4);
  return { targetCalories, proteinG, carbsG, fatG, goalLabel: goal.label, offset, proteinPerKg, defaultProteinPerKg: goal.proteinPerKg };
}

function macroBarStatus(consumed, target) {
  if (!target) return "#8A756B";
  const pct = (consumed / target) * 100;
  if (pct < 80) return "#FFB13D";
  if (pct <= 115) return "#33D6A6";
  return "#FF4B2B";
}

function calorieStatus(total, goal) {
  if (total === 0) return { label: "ยังไม่บันทึกมื้ออาหารวันนี้", color: "#8A756B" };
  const pct = (total / goal) * 100;
  if (pct < 85) return { label: "ต่ำกว่าเป้าหมาย — พลังงานอาจไม่พอซ้อม", color: "#FFB13D" };
  if (pct <= 110) return { label: "อยู่ในเป้าหมาย — สมดุลดี", color: "#33D6A6" };
  return { label: "เกินเป้าหมาย — ระวังส่วนเกิน", color: "#FF4B2B" };
}

export default function VitalProtocol() {
  const [loaded, setLoaded] = useState(false);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [completed, setCompleted] = useState({});
  const [foodLog, setFoodLog] = useState({});
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [profile, setProfile] = useState({ weightKg: "", heightCm: "", age: "", gender: "male", activity: "moderate", goal: "maintain", customOffset: "", customProteinPerKg: "" });
  const [macroTargets, setMacroTargets] = useState({ protein: 150, carbs: 200, fat: 60 });
  const [longest, setLongest] = useState(0);
  const [seenMilestones, setSeenMilestones] = useState([]);

  const [tab, setTab] = useState("training");
  const [note, setNote] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualKcal, setManualKcal] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFat, setManualFat] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [toast, setToast] = useState(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);
  const prevUnlockedCount = useRef(0);

  const today = todayKeyStr();
  const dow = DOW_TO_KEY[new Date().getDay()];
  const todaySchedule = schedule[dow] || [];
  const isRestDay = todaySchedule.length === 0;
  const todayEntry = completed[today] || { checked: {}, dayComplete: false, restConfirmed: false, note: "" };

  // ---- load ----
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("vital-protocol:data");
        if (res) {
          const d = JSON.parse(res.value);
          setSchedule(d.schedule || DEFAULT_SCHEDULE);
          setCompleted(d.completed || {});
          setFoodLog(d.foodLog || {});
          setCalorieGoal(d.calorieGoal || 2000);
          setProfile(d.profile || { weightKg: "", heightCm: "", age: "", gender: "male", activity: "moderate", goal: "maintain", customOffset: "", customProteinPerKg: "" });
          setMacroTargets(d.macroTargets || { protein: 150, carbs: 200, fat: 60 });
          setLongest(d.longest || 0);
          setSeenMilestones(d.seenMilestones || []);
        }
      } catch (e) {
        /* first run, use defaults */
      }
      setLoaded(true);
    })();
  }, []);

  // ---- persist ----
  useEffect(() => {
    if (!loaded) return;
    window.storage
      .set("vital-protocol:data", JSON.stringify({ schedule, completed, foodLog, calorieGoal, profile, macroTargets, longest, seenMilestones }))
      .catch(() => {});
  }, [schedule, completed, foodLog, calorieGoal, profile, macroTargets, longest, seenMilestones, loaded]);

  const currentStreak = useMemo(() => computeCurrentStreak(completed), [completed]);

  useEffect(() => {
    if (!loaded) return;
    if (currentStreak > longest) setLongest(currentStreak);
  }, [currentStreak, longest, loaded]);

  const unlocked = ACHIEVEMENTS.filter((a) => currentStreak >= a.days || longest >= a.days);

  useEffect(() => {
    if (!loaded) return;
    const newlyUnlocked = unlocked.filter((a) => !seenMilestones.includes(a.id));
    if (newlyUnlocked.length > 0) {
      const latest = newlyUnlocked[newlyUnlocked.length - 1];
      setToast(latest);
      setSeenMilestones((prev) => [...prev, ...newlyUnlocked.map((a) => a.id)]);
      const t = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked.length, loaded]);

  const nextMilestone = ACHIEVEMENTS.find((a) => a.days > currentStreak);
  const ringTarget = nextMilestone ? nextMilestone.days : Math.max(currentStreak, 100);
  const ringProgress = Math.min(currentStreak / ringTarget, 1);
  const totalWorkoutDays = Object.values(completed).filter((e) => e.dayComplete).length;

  function toggleExercise(idx) {
    setCompleted((prev) => {
      const entry = prev[today] || { checked: {}, dayComplete: false, restConfirmed: false, note: "" };
      const checked = { ...entry.checked, [idx]: !entry.checked[idx] };
      return { ...prev, [today]: { ...entry, checked } };
    });
  }

  function completeDay() {
    setCompleted((prev) => {
      const entry = prev[today] || { checked: {}, dayComplete: false, restConfirmed: false, note: "" };
      return { ...prev, [today]: { ...entry, dayComplete: true, note } };
    });
    setNote("");
  }

  function confirmRest() {
    setCompleted((prev) => {
      const entry = prev[today] || { checked: {}, dayComplete: false, restConfirmed: false, note: "" };
      return { ...prev, [today]: { ...entry, restConfirmed: true, note } };
    });
    setNote("");
  }

  const allChecked = todaySchedule.length > 0 && todaySchedule.every((_, i) => todayEntry.checked[i]);

  function updateExercise(dayKey, idx, value) {
    setSchedule((prev) => {
      const list = [...prev[dayKey]];
      list[idx] = value;
      return { ...prev, [dayKey]: list };
    });
  }
  function addExercise(dayKey) {
    setSchedule((prev) => ({ ...prev, [dayKey]: [...prev[dayKey], "ท่าใหม่"] }));
  }
  function removeExercise(dayKey, idx) {
    setSchedule((prev) => ({ ...prev, [dayKey]: prev[dayKey].filter((_, i) => i !== idx) }));
  }
  function setRestDay(dayKey) {
    setSchedule((prev) => ({ ...prev, [dayKey]: [] }));
  }

  const tdee = useMemo(() => calcTDEE(profile), [profile]);
  const macroPlan = useMemo(() => calcMacroPlan(tdee, profile), [tdee, profile]);
  function applyTDEE() {
    if (!macroPlan) return;
    setCalorieGoal(macroPlan.targetCalories);
    setMacroTargets({ protein: macroPlan.proteinG, carbs: macroPlan.carbsG, fat: macroPlan.fatG });
  }

  const todayFood = foodLog[today] || [];
  const todayCalories = todayFood.reduce((s, f) => s + (f.calories || 0), 0);
  const todayProtein = todayFood.reduce((s, f) => s + (f.protein || 0), 0);
  const todayCarbs = todayFood.reduce((s, f) => s + (f.carbs || 0), 0);
  const todayFat = todayFood.reduce((s, f) => s + (f.fat || 0), 0);
  const status = calorieStatus(todayCalories, calorieGoal);
  const remainingCalories = calorieGoal - todayCalories;

  const last7 = useMemo(() => {
    const arr = [];
    const cursor = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(cursor.getDate() - i);
      const k = dateKey(d);
      const total = (foodLog[k] || []).reduce((s, f) => s + (f.calories || 0), 0);
      arr.push({ label: d.toLocaleDateString("th-TH", { weekday: "short" }), kcal: total });
    }
    return arr;
  }, [foodLog]);

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      const base64 = await fileToBase64(file);
      setPreviewImage(`data:${file.type || "image/jpeg"};base64,${base64}`);
      const response = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType: file.type || "image/jpeg" }),
      });
      const parsed = await response.json();
      if (parsed.error) throw new Error(parsed.error);
      const newEntry = {
        id: Date.now(),
        name: parsed.food_name || "อาหารไม่ทราบชื่อ",
        calories: Math.round(parsed.estimated_calories || 0),
        protein: Math.round(parsed.protein_g || 0),
        carbs: Math.round(parsed.carbs_g || 0),
        fat: Math.round(parsed.fat_g || 0),
        source: "ai",
      };
      setFoodLog((prev) => ({ ...prev, [today]: [...(prev[today] || []), newEntry] }));
    } catch (err) {
      setAnalyzeError("วิเคราะห์รูปไม่สำเร็จ ลองใหม่ หรือเพิ่มด้วยตนเองด้านล่าง");
    } finally {
      setAnalyzing(false);
      setPreviewImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function addManualFood() {
    const kcal = parseInt(manualKcal, 10);
    if (!manualName.trim() || !kcal) return;
    setFoodLog((prev) => ({
      ...prev,
      [today]: [
        ...(prev[today] || []),
        {
          id: Date.now(),
          name: manualName.trim(),
          calories: kcal,
          protein: parseInt(manualProtein, 10) || 0,
          carbs: parseInt(manualCarbs, 10) || 0,
          fat: parseInt(manualFat, 10) || 0,
          source: "manual",
        },
      ],
    }));
    setManualName("");
    setManualKcal("");
    setManualProtein("");
    setManualCarbs("");
    setManualFat("");
  }
  function removeFood(id) {
    setFoodLog((prev) => ({ ...prev, [today]: (prev[today] || []).filter((f) => f.id !== id) }));
  }

  function resetAll() {
    if (window.confirm("ล้างข้อมูลทั้งหมด (สตรีค, ตาราง, บันทึกอาหาร)? การกระทำนี้ย้อนกลับไม่ได้")) {
      setSchedule(DEFAULT_SCHEDULE);
      setCompleted({});
      setFoodLog({});
      setMacroTargets({ protein: 150, carbs: 200, fat: 60 });
      setLongest(0);
      setSeenMilestones([]);
    }
  }

  const heatCols = useMemo(() => buildHeatmap(completed), [completed]);
  const R = 100, CIRC = 2 * Math.PI * R;
  const glow = Math.min(8 + currentStreak * 1.5, 46);

  return (
    <div className="vp-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;600&family=Inter:wght@400;500;600&display=swap');
        .vp-root { min-height:100vh; background:radial-gradient(circle at 50% -10%,#1a0d09 0%,#0B0705 55%,#050302 100%); color:#F3E9E4; font-family:'Inter',sans-serif; padding:24px 16px 48px; box-sizing:border-box; }
        .vp-root * { box-sizing:border-box; }
        .vp-mono { font-family:'JetBrains Mono',monospace; }
        .vp-display { font-family:'Space Grotesk',sans-serif; }
        button { font-family:inherit; }
        button:focus-visible, input:focus-visible { outline:2px solid #FF4B2B; outline-offset:2px; }

        .vp-wrap { max-width:920px; margin:0 auto; }
        .vp-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:18px; }
        .vp-title { font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:20px; letter-spacing:.02em; display:flex; align-items:center; gap:8px; }
        .vp-title .slash { color:#FF4B2B; }
        .vp-reset { background:none; border:1px solid #2A1A14; color:#8A756B; border-radius:6px; padding:6px 10px; font-size:11px; display:flex; align-items:center; gap:6px; cursor:pointer; }
        .vp-reset:hover { color:#FF4B2B; border-color:#FF4B2B; }

        .vp-core-panel { display:flex; flex-direction:column; align-items:center; background:#120A07; border:1px solid #2A1A14; border-radius:14px; padding:26px 16px; margin-bottom:16px; }
        .vp-gauge { position:relative; width:230px; height:230px; }
        .vp-gauge svg { transform:rotate(-90deg); }
        .vp-ring-bg { fill:none; stroke:#241510; stroke-width:8; }
        .vp-ring-fg { fill:none; stroke:#FF4B2B; stroke-width:8; stroke-linecap:round; filter:drop-shadow(0 0 ${glow}px rgba(255,75,43,0.65)); transition:stroke-dashoffset .6s ease; }
        .vp-gauge-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
        .vp-flame-icon { animation:vp-flicker 1.8s ease-in-out infinite; }
        @keyframes vp-flicker { 0%,100%{ transform:scale(1) rotate(-2deg);} 50%{ transform:scale(1.12) rotate(2deg);} }
        @media (prefers-reduced-motion:reduce){ .vp-flame-icon{animation:none;} }
        .vp-streak-num { font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:52px; line-height:1; margin-top:4px; }
        .vp-streak-label { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.14em; color:#8A756B; margin-top:2px; }
        .vp-substats { display:flex; gap:26px; margin-top:18px; font-family:'JetBrains Mono',monospace; font-size:12px; color:#8A756B; flex-wrap:wrap; justify-content:center; }
        .vp-substats b { color:#F3E9E4; font-size:14px; }

        .vp-tabs { display:flex; gap:8px; margin-bottom:16px; }
        .vp-tab { flex:1; background:#120A07; border:1px solid #2A1A14; color:#8A756B; padding:10px; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:6px; font-size:13px; cursor:pointer; }
        .vp-tab.active { color:#FF4B2B; border-color:#FF4B2B; background:rgba(255,75,43,0.08); }

        .vp-panel { background:#120A07; border:1px solid #2A1A14; border-radius:12px; padding:18px; margin-bottom:14px; }
        .vp-panel h3 { margin:0 0 12px; font-family:'Space Grotesk',sans-serif; font-size:15px; display:flex; align-items:center; gap:8px; }

        .vp-today-list { list-style:none; padding:0; margin:0 0 14px; }
        .vp-today-item { display:flex; align-items:center; gap:10px; padding:10px 8px; border-bottom:1px dashed #241510; cursor:pointer; }
        .vp-check { width:20px; height:20px; border-radius:5px; border:1.5px solid #4A342B; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .vp-check.on { background:#FF4B2B; border-color:#FF4B2B; }
        .vp-today-item.done-text { color:#5C4A40; text-decoration:line-through; }

        .vp-note { width:100%; background:#0B0705; border:1px solid #2A1A14; border-radius:8px; padding:10px; color:#F3E9E4; font-size:13px; resize:vertical; min-height:56px; margin-bottom:10px; }
        .vp-btn { background:#1E100A; border:1px solid #FF4B2B; color:#FF4B2B; padding:10px 16px; border-radius:8px; font-size:13px; display:flex; align-items:center; gap:8px; cursor:pointer; font-family:'JetBrains Mono',monospace; letter-spacing:.04em; }
        .vp-btn:disabled { opacity:.35; cursor:not-allowed; }
        .vp-btn.ghost { background:transparent; border-color:#2A1A14; color:#8A756B; }
        .vp-restday { text-align:center; padding:20px 10px; color:#33D6A6; }

        .vp-day-card { border:1px solid #241510; border-radius:10px; padding:12px; margin-bottom:10px; }
        .vp-day-card.today { border-color:#FF4B2B; }
        .vp-day-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
        .vp-day-head b { font-family:'Space Grotesk',sans-serif; }
        .vp-ex-row { display:flex; gap:6px; align-items:center; margin-bottom:6px; }
        .vp-ex-input { flex:1; background:#0B0705; border:1px solid #241510; border-radius:6px; padding:6px 8px; color:#F3E9E4; font-size:12.5px; }
        .vp-icon-btn { background:none; border:none; color:#5C4A40; cursor:pointer; display:flex; }
        .vp-icon-btn:hover { color:#FF4B2B; }
        .vp-small-link { font-size:11px; color:#8A756B; background:none; border:none; cursor:pointer; text-decoration:underline; padding:2px 0; }

        .vp-heat-scroll { overflow-x:auto; padding-bottom:6px; }
        .vp-heat-grid { display:grid; grid-auto-flow:column; grid-template-rows:repeat(7,12px); gap:3px; }
        .vp-heat-cell { width:12px; height:12px; border-radius:3px; background:#1A100C; }
        .vp-heat-cell.rest { background:#1F3B33; }
        .vp-heat-cell.today-ring { outline:1.5px solid #F3E9E4; outline-offset:1px; }
        .vp-legend { display:flex; gap:6px; align-items:center; font-size:11px; color:#8A756B; margin-top:10px; }
        .vp-legend .sw { width:10px; height:10px; border-radius:2px; }

        .vp-ach-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px; margin-top:14px; }
        .vp-ach { border:1px solid #241510; border-radius:10px; padding:12px; text-align:center; opacity:.35; }
        .vp-ach.unlocked { opacity:1; border-color:#FF4B2B; background:rgba(255,75,43,0.06); }
        .vp-ach-icon { margin-bottom:6px; }
        .vp-ach-label { font-size:11.5px; }
        .vp-ach-days { font-family:'JetBrains Mono',monospace; font-size:10px; color:#8A756B; margin-top:2px; }

        .vp-log-item { display:flex; justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px dashed #241510; font-size:12.5px; }
        .vp-log-date { font-family:'JetBrains Mono',monospace; color:#8A756B; white-space:nowrap; }

        .vp-profile-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:10px; }
        .vp-field { display:flex; flex-direction:column; gap:5px; font-size:11.5px; color:#8A756B; }
        .vp-field .vp-goal-input, .vp-field .vp-ex-input { width:100%; }
        .vp-goal-row { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
        .vp-goal-input { width:100px; background:#0B0705; border:1px solid #2A1A14; border-radius:6px; padding:6px 8px; color:#F3E9E4; font-family:'JetBrains Mono',monospace; }
        .vp-progress-bar { height:8px; border-radius:5px; background:#1A100C; overflow:hidden; margin:10px 0; }
        .vp-progress-fill { height:100%; border-radius:5px; transition:width .4s ease; }
        .vp-status-badge { font-size:12.5px; padding:4px 0; font-weight:600; }
        .vp-photo-btn { display:flex; align-items:center; gap:8px; background:#1E100A; border:1px dashed #FF4B2B; color:#FF4B2B; padding:14px; border-radius:10px; justify-content:center; cursor:pointer; margin-bottom:10px; font-size:13px; }
        .vp-food-item { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed #241510; font-size:13px; }
        .vp-food-meta { font-size:11px; color:#8A756B; }
        .vp-manual-row { display:flex; gap:6px; margin-top:10px; }
        .vp-toast { position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#1E100A; border:1px solid #FF4B2B; color:#F3E9E4; padding:12px 18px; border-radius:10px; display:flex; align-items:center; gap:10px; z-index:50; box-shadow:0 0 30px rgba(255,75,43,.3); }

        .vp-calendar { width: 100%; display: flex; flex-direction: column; gap: 10px; }
        .vp-cal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .vp-cal-nav { background: #1A100C; border: 1px solid #2A1A14; color: #F3E9E4; border-radius: 6px; padding: 4px 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .vp-cal-nav:hover { background: #2A1A14; color: #FF4B2B; }
        .vp-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .vp-cal-day-head { text-align: center; font-size: 11px; color: #8A756B; font-weight: 600; padding: 4px 0; }
        .vp-cal-cell { aspect-ratio: 1; border-radius: 6px; background: #1A100C; display: flex; align-items: center; justify-content: center; font-size: 13px; font-family: 'Space Grotesk', sans-serif; position: relative; border: 1px solid transparent; }
        .vp-cal-cell.empty { background: transparent; }
        .vp-cal-cell.rest { background: #1F3B33; color: #33D6A6; border-color: #2E5C4E; }
        .vp-cal-cell.done { background: rgba(255, 75, 43, 0.15); color: #FF4B2B; border-color: #FF4B2B; }
        .vp-cal-cell.today { border: 1.5px solid #F3E9E4; }
        
        .vp-fab { position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px; border-radius: 28px; background: #FF4B2B; color: #000; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(255, 75, 43, 0.4); border: none; cursor: pointer; z-index: 100; transition: transform 0.2s; }
        .vp-fab:active { transform: scale(0.9); }
        .vp-fab:hover { transform: scale(1.05); }

        .vp-scanner-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 200; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
        .vp-scanner-box { position: relative; max-width: 90%; max-height: 70%; border-radius: 12px; overflow: hidden; border: 2px solid #FF4B2B; box-shadow: 0 0 30px rgba(255, 75, 43, 0.3); }
        .vp-scanner-img { display: block; width: 100%; height: auto; max-height: 60vh; object-fit: contain; }
        .vp-scanner-line { position: absolute; top: 0; left: 0; right: 0; height: 3px; background: #FF4B2B; box-shadow: 0 0 15px #FF4B2B, 0 0 30px #FF4B2B; animation: vp-scan 1.8s linear infinite alternate; }
        @keyframes vp-scan { 0% { top: 0%; } 100% { top: calc(100% - 3px); } }
        .vp-scanner-text { margin-top: 20px; font-family: 'Space Grotesk', sans-serif; font-size: 16px; color: #FF4B2B; font-weight: 600; display: flex; align-items: center; gap: 10px; }
      `}</style>

      <div className="vp-wrap">
        <div className="vp-header">
          <div className="vp-title"><Dumbbell size={20} color="#FF4B2B" /> VITAL<span className="slash">//</span>PROTOCOL</div>
          <button className="vp-reset" onClick={resetAll}><RotateCcw size={12} /> ล้างข้อมูล</button>
        </div>

        {/* CORE */}
        <div className="vp-core-panel">
          <div className="vp-gauge">
            <svg width="230" height="230" viewBox="0 0 230 230">
              <circle className="vp-ring-bg" cx="115" cy="115" r={R} />
              <circle className="vp-ring-fg" cx="115" cy="115" r={R} strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - ringProgress)} />
            </svg>
            <div className="vp-gauge-center">
              <Flame className="vp-flame-icon" size={28} color="#FF4B2B" fill="#FF4B2B" />
              <div className="vp-streak-num">{currentStreak}</div>
              <div className="vp-streak-label">DAYS UNBROKEN</div>
            </div>
          </div>
          <div className="vp-substats">
            <div>STREAK สูงสุด <b>{longest}</b></div>
            <div>วันซ้อมรวม <b>{totalWorkoutDays}</b></div>
            <div>เป้าถัดไป <b>{nextMilestone ? `${nextMilestone.days} วัน` : "MAX"}</b></div>
          </div>
        </div>

        {/* TABS */}
        <div className="vp-tabs">
          <button className={`vp-tab ${tab === "training" ? "active" : ""}`} onClick={() => setTab("training")}><Dumbbell size={14} /> TRAINING</button>
          <button className={`vp-tab ${tab === "grid" ? "active" : ""}`} onClick={() => setTab("grid")}><Calendar size={14} /> GRID</button>
          <button className={`vp-tab ${tab === "fuel" ? "active" : ""}`} onClick={() => setTab("fuel")}><UtensilsCrossed size={14} /> FUEL</button>
        </div>

        {tab === "training" && (
          <>
            <div className="vp-panel">
              <h3><Zap size={15} color="#FF4B2B" /> วันนี้ — {DAY_LABEL[dow]}</h3>
              {isRestDay ? (
                todayEntry.restConfirmed ? (
                  <div className="vp-restday">✓ ยืนยันวันพักแล้ว — ร่างกายก็ต้องการเวลาฟื้นตัว</div>
                ) : (
                  <>
                    <div className="vp-restday">วันนี้เป็นวันพักตามตาราง</div>
                    <textarea className="vp-note" placeholder="บันทึกความรู้สึก/ความสำเร็จวันนี้ (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} />
                    <button className="vp-btn" onClick={confirmRest}><Check size={14} /> ยืนยันวันพัก</button>
                  </>
                )
              ) : todayEntry.dayComplete ? (
                <div className="vp-restday" style={{ color: "#33D6A6" }}>✓ จบเซสชันวันนี้แล้ว — วินัยไม่มีขาด</div>
              ) : (
                <>
                  <ul className="vp-today-list">
                    {todaySchedule.map((ex, i) => (
                      <li key={i} className={`vp-today-item ${todayEntry.checked[i] ? "done-text" : ""}`} onClick={() => toggleExercise(i)}>
                        <span className={`vp-check ${todayEntry.checked[i] ? "on" : ""}`}>{todayEntry.checked[i] && <Check size={13} color="#0B0705" />}</span>
                        {ex}
                      </li>
                    ))}
                  </ul>
                  <textarea className="vp-note" placeholder="บันทึกความรู้สึก/ความสำเร็จวันนี้ (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <button className="vp-btn" disabled={!allChecked} onClick={completeDay}>
                    <Check size={14} /> {allChecked ? "จบเซสชันวันนี้" : "เช็คให้ครบทุกท่าก่อน"}
                  </button>
                </>
              )}
            </div>

            <div className="vp-panel">
              <h3>ตารางประจำสัปดาห์</h3>
              {DAY_KEYS.map((k) => (
                <div key={k} className={`vp-day-card ${k === dow ? "today" : ""}`}>
                  <div className="vp-day-head">
                    <b>{DAY_LABEL[k]}{k === dow ? " · TODAY" : ""}</b>
                    <button className="vp-small-link" onClick={() => setRestDay(k)}>ตั้งเป็นวันพัก</button>
                  </div>
                  {schedule[k].length === 0 ? (
                    <div style={{ fontSize: 12.5, color: "#8A756B" }}>วันพัก</div>
                  ) : (
                    schedule[k].map((ex, i) => (
                      <div className="vp-ex-row" key={i}>
                        <input className="vp-ex-input" value={ex} onChange={(e) => updateExercise(k, i, e.target.value)} />
                        <button className="vp-icon-btn" onClick={() => removeExercise(k, i)}><Trash2 size={14} /></button>
                      </div>
                    ))
                  )}
                  <button className="vp-small-link" style={{ marginTop: 4 }} onClick={() => addExercise(k)}>+ เพิ่มท่า</button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "grid" && (
          <>
            <div className="vp-panel">
              <h3><Calendar size={15} color="#FF4B2B" /> Discipline Calendar</h3>
              <div className="vp-calendar">
                <div className="vp-cal-header">
                  <button className="vp-cal-nav" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
                  <div style={{ fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>
                    {MONTH_NAMES[calendarDate.getMonth()]} {calendarDate.getFullYear()}
                  </div>
                  <button className="vp-cal-nav" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
                </div>
                <div className="vp-cal-grid">
                  {["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((d, i) => <div key={i} className="vp-cal-day-head">{d}</div>)}
                  {Array.from({ length: (getFirstDayOfMonth(calendarDate.getFullYear(), calendarDate.getMonth()) + 6) % 7 }).map((_, i) => <div key={`empty-${i}`} className="vp-cal-cell empty" />)}
                  {Array.from({ length: getDaysInMonth(calendarDate.getFullYear(), calendarDate.getMonth()) }).map((_, i) => {
                    const d = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), i + 1);
                    const k = dateKey(d);
                    const isFuture = d > new Date(new Date().setHours(0,0,0,0));
                    const isToday = k === today;
                    const entry = completed[k];
                    let cls = "vp-cal-cell";
                    if (isToday) cls += " today";
                    if (!isFuture && entry?.dayComplete) cls += " done";
                    else if (!isFuture && entry?.restConfirmed) cls += " rest";
                    return (
                      <div key={i} className={cls} title={thaiDateLabel(k)}>
                        {i + 1}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="vp-legend">
                <span className="sw" style={{ background: "#1A100C" }} /> ไม่มีบันทึก
                <span className="sw" style={{ background: "#1F3B33", border: "1px solid #2E5C4E", marginLeft: 8 }} /> วันพัก
                <span className="sw" style={{ background: "rgba(255,75,43,0.15)", border: "1px solid #FF4B2B", marginLeft: 8 }} /> ซ้อมสำเร็จ
              </div>
            </div>

            <div className="vp-panel">
              <h3><Trophy size={15} color="#FF4B2B" /> Achievements</h3>
              <div className="vp-ach-grid">
                {ACHIEVEMENTS.map((a) => {
                  const Icon = a.icon;
                  const isUnlocked = unlocked.some((u) => u.id === a.id);
                  return (
                    <div key={a.id} className={`vp-ach ${isUnlocked ? "unlocked" : ""}`}>
                      <div className="vp-ach-icon"><Icon size={22} color={isUnlocked ? "#FF4B2B" : "#5C4A40"} /></div>
                      <div className="vp-ach-label">{a.label}</div>
                      <div className="vp-ach-days">{a.days} วันติดต่อกัน</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="vp-panel">
              <h3>Success Log</h3>
              {Object.entries(completed)
                .filter(([, v]) => v.note)
                .sort((a, b) => (a[0] < b[0] ? 1 : -1))
                .slice(0, 30)
                .map(([k, v]) => (
                  <div className="vp-log-item" key={k}>
                    <span className="vp-log-date">{thaiDateLabel(k)}</span>
                    <span style={{ flex: 1 }}>{v.note}</span>
                  </div>
                ))}
              {Object.values(completed).filter((v) => v.note).length === 0 && (
                <div style={{ fontSize: 12.5, color: "#8A756B" }}>ยังไม่มีบันทึก — เขียนความรู้สึกหลังจบเซสชันแต่ละวันได้ที่แท็บ TRAINING</div>
              )}
            </div>
          </>
        )}

        {tab === "fuel" && (
          <>
            <div className="vp-panel">
              <h3><Zap size={15} color="#FF4B2B" /> ข้อมูลร่างกาย</h3>
              <div className="vp-profile-grid">
                <label className="vp-field">
                  <span>น้ำหนัก (กก.)</span>
                  <input className="vp-goal-input" type="number" value={profile.weightKg} onChange={(e) => setProfile((p) => ({ ...p, weightKg: e.target.value }))} />
                </label>
                <label className="vp-field">
                  <span>ส่วนสูง (ซม.)</span>
                  <input className="vp-goal-input" type="number" value={profile.heightCm} onChange={(e) => setProfile((p) => ({ ...p, heightCm: e.target.value }))} />
                </label>
                <label className="vp-field">
                  <span>อายุ</span>
                  <input className="vp-goal-input" type="number" value={profile.age} onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value }))} />
                </label>
                <label className="vp-field">
                  <span>เพศ</span>
                  <select className="vp-goal-input" value={profile.gender} onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value }))}>
                    <option value="male">ชาย</option>
                    <option value="female">หญิง</option>
                  </select>
                </label>
              </div>
              <label className="vp-field" style={{ width: "100%", marginTop: 10 }}>
                <span>ระดับกิจกรรม</span>
                <select className="vp-ex-input" value={profile.activity} onChange={(e) => setProfile((p) => ({ ...p, activity: e.target.value }))}>
                  {ACTIVITY_LEVELS.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </label>

              <label className="vp-field" style={{ width: "100%", marginTop: 10 }}>
                <span>เป้าหมาย</span>
                <select className="vp-ex-input" value={profile.goal} onChange={(e) => setProfile((p) => ({ ...p, goal: e.target.value }))}>
                  {GOALS.map((g) => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </label>
              {profile.goal === "custom" && (
                <label className="vp-field" style={{ width: "100%", marginTop: 10 }}>
                  <span>ปรับแคลเอง (+ เพิ่ม / - ลด จาก TDEE)</span>
                  <input className="vp-ex-input" type="number" placeholder="เช่น -300 หรือ 400" value={profile.customOffset} onChange={(e) => setProfile((p) => ({ ...p, customOffset: e.target.value }))} />
                </label>
              )}
              <label className="vp-field" style={{ width: "100%", marginTop: 10 }}>
                <span>โปรตีนต่อน้ำหนักตัว (g/kg) — ไม่บังคับ ถ้าไม่กรอกใช้ค่าเริ่มต้นของเป้าหมายที่เลือก{macroPlan ? ` (${macroPlan.defaultProteinPerKg} g/kg)` : ""}</span>
                <input className="vp-ex-input" type="number" step="0.1" placeholder={macroPlan ? `ค่าเริ่มต้น ${macroPlan.defaultProteinPerKg}` : "เช่น 1.6"} value={profile.customProteinPerKg} onChange={(e) => setProfile((p) => ({ ...p, customProteinPerKg: e.target.value }))} />
              </label>

              {macroPlan ? (
                <div style={{ marginTop: 14, fontSize: 12.5, color: "#8A756B" }}>
                  <div>TDEE โดยประมาณ: <b className="vp-mono" style={{ color: "#F3E9E4" }}>{tdee} kcal</b></div>
                  <div style={{ marginTop: 4 }}>
                    เป้าหมาย ({macroPlan.goalLabel}): <b className="vp-mono" style={{ color: "#FF4B2B" }}>{macroPlan.targetCalories} kcal</b>
                    {macroPlan.offset !== 0 && <span> ({macroPlan.offset > 0 ? "+" : ""}{macroPlan.offset} จาก TDEE)</span>}
                  </div>
                  <div style={{ marginTop: 6 }}>โปรตีน {macroPlan.proteinG} g · คาร์บ {macroPlan.carbsG} g · ไขมัน {macroPlan.fatG} g</div>
                  <button className="vp-btn ghost" style={{ marginTop: 10 }} onClick={applyTDEE}>ใช้ค่านี้เป็นเป้าหมาย + สารอาหาร</button>
                </div>
              ) : (
                <div style={{ marginTop: 12, fontSize: 12, color: "#8A756B" }}>กรอกน้ำหนัก ส่วนสูง และอายุ ให้ครบ เพื่อคำนวณแคลและสารอาหารที่ควรได้รับต่อวันอัตโนมัติ</div>
              )}
            </div>

            <div className="vp-panel">
              <h3><UtensilsCrossed size={15} color="#FF4B2B" /> เป้าหมายแคลอรี่ต่อวัน</h3>
              <div className="vp-goal-row">
                <input className="vp-goal-input" type="number" value={calorieGoal} onChange={(e) => setCalorieGoal(parseInt(e.target.value, 10) || 0)} />
                <span style={{ fontSize: 12.5, color: "#8A756B" }}>kcal / วัน</span>
              </div>
              <div className="vp-progress-bar">
                <div className="vp-progress-fill" style={{ width: `${Math.min((todayCalories / calorieGoal) * 100, 100)}%`, background: status.color }} />
              </div>
              <div className="vp-status-badge" style={{ color: status.color }}>{todayCalories} / {calorieGoal} kcal — {status.label}</div>
              <div style={{ fontSize: 12, color: "#8A756B", marginTop: 4 }}>
                {remainingCalories >= 0 ? <>วันนี้ยังกินได้อีก <b style={{ color: "#F3E9E4" }}>{remainingCalories} kcal</b></> : <>เกินเป้าไปแล้ว <b style={{ color: "#FF4B2B" }}>{Math.abs(remainingCalories)} kcal</b></>}
              </div>
            </div>

            <div className="vp-panel">
              <h3>สรุปสารอาหารวันนี้</h3>
              {[
                { label: "โปรตีน", value: todayProtein, target: macroTargets.protein },
                { label: "คาร์โบไฮเดรต", value: todayCarbs, target: macroTargets.carbs },
                { label: "ไขมัน", value: todayFat, target: macroTargets.fat },
              ].map((m) => (
                <div key={m.label} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                    <span>{m.label}</span>
                    <span className="vp-mono">{m.value} / {m.target} g</span>
                  </div>
                  <div className="vp-progress-bar">
                    <div className="vp-progress-fill" style={{ width: `${Math.min((m.value / (m.target || 1)) * 100, 100)}%`, background: macroBarStatus(m.value, m.target) }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#8A756B", marginTop: 2 }}>
                    {m.target - m.value >= 0 ? `เหลืออีก ${m.target - m.value} g` : `เกินไป ${m.value - m.target} g`}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: "#5C4A40", marginTop: 4 }}>* เป้าหมายสารอาหารตั้งจากการ์ด "ข้อมูลร่างกาย" ด้านบน หรือแก้ตัวเลขในโค้ดได้โดยตรง</div>
            </div>

            <div className="vp-panel">
              <h3>บันทึกมื้ออาหารวันนี้</h3>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
              <button className="vp-photo-btn" onClick={() => fileInputRef.current?.click()} disabled={analyzing}>
                {analyzing ? <Loader2 size={16} className="vp-flame-icon" /> : <Camera size={16} />}
                {analyzing ? "กำลังวิเคราะห์รูปด้วย AI..." : "แนบรูปอาหาร — ให้ AI คำนวณแคลให้"}
              </button>
              {analyzeError && <div style={{ color: "#FF4B2B", fontSize: 12, marginBottom: 8 }}>{analyzeError}</div>}

              {todayFood.map((f) => (
                <div className="vp-food-item" key={f.id}>
                  <div>
                    <div>{f.name}</div>
                    {(f.protein || f.carbs || f.fat) ? <div className="vp-food-meta">P {f.protein}g · C {f.carbs}g · F {f.fat}g</div> : null}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <b className="vp-mono">{f.calories} kcal</b>
                    <button className="vp-icon-btn" onClick={() => removeFood(f.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {todayFood.length === 0 && <div style={{ fontSize: 12.5, color: "#8A756B" }}>ยังไม่มีบันทึกมื้ออาหารวันนี้</div>}

              <div className="vp-manual-row" style={{ flexWrap: "wrap" }}>
                <input className="vp-ex-input" style={{ minWidth: 140 }} placeholder="เพิ่มเอง: ชื่ออาหาร" value={manualName} onChange={(e) => setManualName(e.target.value)} />
                <input className="vp-goal-input" style={{ width: 80 }} placeholder="kcal" type="number" value={manualKcal} onChange={(e) => setManualKcal(e.target.value)} />
                <input className="vp-goal-input" style={{ width: 70 }} placeholder="P g" type="number" value={manualProtein} onChange={(e) => setManualProtein(e.target.value)} />
                <input className="vp-goal-input" style={{ width: 70 }} placeholder="C g" type="number" value={manualCarbs} onChange={(e) => setManualCarbs(e.target.value)} />
                <input className="vp-goal-input" style={{ width: 70 }} placeholder="F g" type="number" value={manualFat} onChange={(e) => setManualFat(e.target.value)} />
                <button className="vp-btn ghost" onClick={addManualFood}><Plus size={14} /></button>
              </div>
            </div>

            <div className="vp-panel">
              <h3>แคลอรี่ 7 วันล่าสุด</h3>
              <div style={{ width: "100%", height: 160 }}>
                <ResponsiveContainer>
                  <BarChart data={last7}>
                    <XAxis dataKey="label" stroke="#8A756B" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "#120A07", border: "1px solid #2A1A14", fontSize: 12 }} labelStyle={{ color: "#F3E9E4" }} />
                    <Bar dataKey="kcal" fill="#FF4B2B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>

      {toast && (
        <div className="vp-toast">
          <Trophy size={18} color="#FF4B2B" />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>ปลดล็อกความสำเร็จ!</div>
            <div style={{ fontSize: 12, color: "#8A756B" }}>{toast.label} · {toast.days} วันติดต่อกัน</div>
          </div>
          <button className="vp-icon-btn" onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      {/* Persistent FAB */}
      <button className="vp-fab" onClick={() => fileInputRef.current?.click()} aria-label="ถ่ายรูปอาหาร">
        <Camera size={24} color="#000" />
      </button>

      {/* Scanner Overlay */}
      {analyzing && previewImage && (
        <div className="vp-scanner-overlay">
          <div className="vp-scanner-box">
            <img src={previewImage} alt="scanning" className="vp-scanner-img" />
            <div className="vp-scanner-line"></div>
          </div>
          <div className="vp-scanner-text">
            <Loader2 size={18} className="vp-flame-icon" /> กำลังวิเคราะห์รูปด้วย AI...
          </div>
        </div>
      )}
    </div>
  );
}
