"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { AlertTriangle, Check, ExternalLink, RefreshCw } from "lucide-react"

interface AthleteProfile {
  first_name: string | null
  last_name: string | null
  position: string | null
  grad_year: number | null
  high_school: string | null
  hudl_url: string | null
  city: string | null
  state: string | null
}

interface ContentCalendarProps {
  profile: AthleteProfile
}

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "training",   label: "Training",   icon: "💪" },
  { id: "film",       label: "Film",       icon: "🎬" },
  { id: "gameday",    label: "Game Day",   icon: "🏈" },
  { id: "academic",   label: "Academics",  icon: "📚" },
  { id: "recruiting", label: "Recruiting", icon: "🎯" },
  { id: "mindset",    label: "Mindset",    icon: "🔥" },
  { id: "team",       label: "Team",       icon: "🤝" },
  { id: "offseason",  label: "Off-Season", icon: "⚡" },
]

// ─── Post Repository ──────────────────────────────────────────────────────────

const POSTS: Record<string, string[]> = {
  training: [
    "Back in the weight room. This is where the separation happens.\n\n#Classof((Grad Year)) #((Position))Recruiting #CollegeFootball",
    "5 AM lift done. Most people are still sleeping. That's kind of the point.\n\n#((Position)) #Classof((Grad Year))",
    "Speed work this morning. Been tracking my 40 every couple weeks — the number is dropping.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Another day, another grind. ((Position))s don't take days off.\n\n#Classof((Grad Year)) #RecruitMe",
    "Finished a brutal conditioning session. Legs are gone. Mind is sharp. That's the standard.\n\n#Classof((Grad Year)) #((Position))Recruiting",
    "Worked on footwork for two hours today. The details are what wins games.\n\n#CollegeFootball #Classof((Grad Year))",
    "Not every workout feels good. Today was ugly. Showed up anyway.\n\n#Classof((Grad Year)) #WorkEthic",
    "Technique over everything right now. Locking in the fundamentals before camp season hits.\n\n#((Position)) #Classof((Grad Year)) #CollegeFootball",
    "Hit a new personal best in the weight room. Building every single week.\n\n#Classof((Grad Year)) #((Position))Recruiting",
    "Explosiveness work this morning. Coming out of my stance faster than I was 3 months ago — it shows.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Two-a-days mentality. Not because I have to — because somebody I'm competing with for a spot is out there grinding.\n\n#Classof((Grad Year)) #((Position))",
    "Film in the morning. Lift at noon. Drills in the evening. This is the job.\n\n#RecruitMe #Classof((Grad Year))",
    "Didn't feel like going today. Went anyway. Those are honestly the reps that matter most.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Working on the little things coaches notice. Every rep is a rep toward a scholarship.\n\n#((Position)) #Classof((Grad Year))",
    "Recovery is training too. Ice bath done. Ready for tomorrow.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Three things I'm locked in on this month: explosiveness, hand placement, film knowledge.\n\n#Classof((Grad Year)) #((Position))Recruiting",
    "Every coach wants to know what you do when nobody's watching. I'm building that answer right now.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Morning sprint work. My first step has gotten noticeably quicker. The work is showing up.\n\n#Classof((Grad Year)) #((Position))",
    "Position-specific work today. Coaches at the next level will see someone who knows their craft inside out.\n\n#((Position)) #Classof((Grad Year))",
    "No shortcuts. No excuses. Just work.\n\n((High School)) → College\n\n#Classof((Grad Year)) #((Position))Recruiting",
    "I track every workout. Every lift. Every sprint time. If you can measure it, you can improve it.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Somebody is watching film on me right now. I want them to keep watching.\n\n#Classof((Grad Year)) #((Position))Recruiting",
  ],
  film: [
    "Dropped new film. Watch how I work versus press coverage.\n\n((Film Link))\n\n#((Position)) #Classof((Grad Year)) #CollegeFootball",
    "Breaking down my game tape this week. Every rep on film is feedback.\n\n#Classof((Grad Year)) #((Position))Recruiting",
    "Put together some highlights from this season. Letting the film do the talking.\n\n((Film Link))\n\n#Classof((Grad Year)) #CollegeFootball",
    "New clip up. Focus on my release off the line — been working on this all offseason.\n\n((Film Link))\n\n#((Position)) #Classof((Grad Year))",
    "Film session this morning. Found three things to clean up before next week. I love this process.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Here's my film. Coaches — come see what I'm about.\n\n((Film Link))\n\n#((Position))Recruiting #Classof((Grad Year))",
    "Went back and watched film from six months ago. The growth is real. Still a long way to go.\n\n#Classof((Grad Year)) #CollegeFootball",
    "New film up. Pay attention to how I set my blocks in the second clip.\n\n((Film Link))\n\n#((Position)) #Classof((Grad Year)) #RecruitMe",
    "New highlight package is live. Coaches — DMs are open.\n\n((Film Link))\n\n#Classof((Grad Year)) #((Position))Recruiting",
    "Film doesn't lie. This is what I've been building toward.\n\n((Film Link))\n\n#Classof((Grad Year)) #CollegeFootball",
    "Fresh tape from Friday night. Full game film available on request.\n\n((Film Link))\n\n#((Position)) #Classof((Grad Year))",
    "Spent an hour breaking down how college ((Position))s play their position. Then went to practice. Film makes you smarter.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Just updated my highlights. Coaches who want the full game film, my contact info is in the link.\n\n((Film Link))\n\n#Classof((Grad Year)) #((Position))Recruiting",
    "Film is the great equalizer. Doesn't matter what you tell coaches — what matters is what they see.\n\n((Film Link))\n\n#Classof((Grad Year)) #CollegeFootball",
    "Cut a new reel focused on my best performance of the year. Come look.\n\n((Film Link))\n\n#((Position)) #Classof((Grad Year))",
    "Coaches — full game tape is available. The highlight reel is just the preview.\n\n((Film Link))\n\n#Classof((Grad Year)) #((Position))Recruiting #CollegeFootball",
    "New film dropped. Notice how I finish through the whistle on every single rep.\n\n((Film Link))\n\n#Classof((Grad Year)) #((Position))",
    "Updated film showing improvement in the exact areas I've been grinding on.\n\n((Film Link))\n\n#Classof((Grad Year)) #CollegeFootball #RecruitMe",
    "Film study + live reps = growth. Here's what it looks like.\n\n((Film Link))\n\n#Classof((Grad Year)) #((Position))Recruiting",
  ],
  gameday: [
    "Game day. All the work we've put in this week — tonight is the reason.\n\n((High School)) 🏈\n\n#FridayNightLights #Classof((Grad Year))",
    "Ready. Let's go.\n\n#((High School)) #Classof((Grad Year)) #FridayNightLights",
    "Pre-game routine is locked in. Headphones in. Focused.\n\n((High School)) football. Let's work.\n\n#Classof((Grad Year)) #FridayNightLights",
    "Win or lose, you leave everything on that field. That's the standard at ((High School)).\n\n#Classof((Grad Year)) #CollegeFootball",
    "Scouts in the stands tonight. Good. I work better when there are eyes on me.\n\n#Classof((Grad Year)) #((Position))Recruiting",
    "Three things I'm focused on tonight: first step, finishing my assignments, staying disciplined.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Nothing hits like Friday nights under the lights. This is why I put in all those reps.\n\n#FridayNightLights #((High School)) #Classof((Grad Year))",
    "Every practice this week was preparation for tonight.\n\n#Classof((Grad Year)) #FridayNightLights #CollegeFootball",
    "Post-game: gave everything I had. Plenty of film to go through tomorrow. Always more to improve.\n\n#Classof((Grad Year)) #((Position))",
    "Big night for the team. Proud of how we competed. Back to work Monday.\n\n#((High School)) #Classof((Grad Year)) #CollegeFootball",
    "Didn't get the result we wanted tonight. That's part of it. The response starts tomorrow.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Walked off the field tonight knowing I left it all out there. That's all you can ask for.\n\n#Classof((Grad Year)) #FridayNightLights",
    "Film review in the morning. Already know exactly what to fix.\n\n#Classof((Grad Year)) #((Position))Recruiting",
    "The team showed up tonight. ((High School)) football — no shortage of fight in this locker room.\n\n#Classof((Grad Year)) #CollegeFootball",
    "My job on Friday nights is simple: be the most prepared guy on that field.\n\n#FridayNightLights #Classof((Grad Year)) #((Position))",
    "Game week is my favorite week. Everything sharpens.\n\n#Classof((Grad Year)) #CollegeFootball #FridayNightLights",
  ],
  academic: [
    "Student-athlete. In that order when it matters.\n\nClassroom is part of the recruiting film too.\n\n#StudentAthlete #Classof((Grad Year))",
    "Honor roll this semester. Football is the goal — grades are what keep the door open.\n\n#Classof((Grad Year)) #StudentAthlete #CollegeFootball",
    "Coaches recruit the whole person. My academics are a strength, not just a checkbox.\n\n#Classof((Grad Year)) #RecruitMe",
    "Film session last night. Study session this morning. This is what being a student-athlete actually looks like.\n\n#Classof((Grad Year)) #CollegeFootball",
    "The scholarship covers my education. That's exactly why I take both seriously.\n\n#Classof((Grad Year)) #StudentAthlete",
    "Good grades mean more options. More options mean more leverage in the recruiting process. Building both.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Test today. Practice tonight. A balance I've been building for four years.\n\n#StudentAthlete #Classof((Grad Year))",
    "College coaches look at transcripts, not just tape. Fortunate to have both working in my favor.\n\n#Classof((Grad Year)) #RecruitMe #CollegeFootball",
    "People underestimate how much the classroom matters in recruiting. I don't.\n\n#StudentAthlete #Classof((Grad Year)) #CollegeFootball",
    "Time management is a skill. Football forced me to develop it. Now it's a genuine competitive advantage.\n\n#Classof((Grad Year)) #CollegeFootball",
    "My education doesn't stop when the career does. That's why school is serious right now.\n\n#StudentAthlete #Classof((Grad Year))",
    "AP classes + football + film study + recruiting. The schedule isn't easy. That's the point.\n\n#Classof((Grad Year)) #CollegeFootball #StudentAthlete",
    "Best thing a recruit can control right now: their GPA. Locked in on mine.\n\n#Classof((Grad Year)) #StudentAthlete #RecruitMe",
  ],
  recruiting: [
    "Great visit this weekend. Taking in the facilities, culture, and staff before making any decisions.\n\n#Classof((Grad Year)) #CollegeFootball #Recruiting",
    "On campus this weekend. The process is very real right now.\n\n#Classof((Grad Year)) #RecruitMe #CollegeFootball",
    "The recruiting process teaches you a lot about yourself. Grateful for every conversation I'm having.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Competed at a camp this weekend against some serious talent. Made the most of every rep.\n\n#Classof((Grad Year)) #((Position))Recruiting",
    "Building relationships with the programs I want to be part of. The right fit matters more than the name on the helmet.\n\n#Classof((Grad Year)) #CollegeFootball #RecruitMe",
    "Active in the process and enjoying every minute of it. This is what you work toward.\n\n#Classof((Grad Year)) #((Position)) #CollegeFootball",
    "Camp season is here. Ready to put my film in front of as many coaches as possible.\n\n#Classof((Grad Year)) #((Position))Recruiting",
    "The goal has always been to play at the next level. Working every day to make it real.\n\n#Classof((Grad Year)) #CollegeFootball #RecruitMe",
    "Good conversation with a coach today. Building relationships the right way.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Film is out. Coaches — my contact info is in the bio. Let's connect.\n\n((Film Link))\n\n#Classof((Grad Year)) #((Position))Recruiting",
    "Grateful for every program that's taken the time to evaluate me. The process is making me sharper.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Looking for programs that develop ((Position))s the right way at the next level. If that's your staff, reach out.\n\n#Classof((Grad Year)) #((Position))Recruiting",
    "Every rep I take right now is working toward a decision I'll make next year. That keeps me locked in.\n\n#Classof((Grad Year)) #CollegeFootball #RecruitMe",
    "Unofficial visits, camp performances, film updates — the recruiting process is a full-time job when you're serious.\n\n#Classof((Grad Year)) #((Position))Recruiting",
  ],
  mindset: [
    "The grind doesn't stop because it gets hard. It stops when you quit. Not happening.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Compete. Improve. Repeat. That's genuinely the whole formula.\n\n#Classof((Grad Year)) #((Position)) #Mindset",
    "Not the biggest. Not the fastest. But I'll be one of the most prepared guys on that field.\n\n#Classof((Grad Year)) #CollegeFootball #RecruitMe",
    "Every player competing for the same scholarship I want is working right now. So am I.\n\n#Classof((Grad Year)) #((Position))Recruiting",
    "Process over results. The results follow when the process is right.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Nobody is coming to hand you anything. You earn it or you don't. Simple as that.\n\n#Classof((Grad Year)) #CollegeFootball #Mindset",
    "I don't compare myself to other recruits. I compare myself to who I was last month.\n\n#Classof((Grad Year)) #((Position)) #CollegeFootball",
    "Failure is a data point. I've collected a few. Every one of them made me better.\n\n#Classof((Grad Year)) #CollegeFootball #Mindset",
    "The players who make it aren't always the most talented. They're the most consistent.\n\n#Classof((Grad Year)) #CollegeFootball #RecruitMe",
    "((City)), ((State)) is producing a college football player. You're looking at him.\n\n#Classof((Grad Year)) #((Position)) #CollegeFootball",
    "I write down my goals every morning. Then I go earn them.\n\n#Classof((Grad Year)) #CollegeFootball #Mindset",
    "There's a version of me 12 months from now looking back at this moment. I'm building for him.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Pressure is a privilege. It means you're in a position worth competing for.\n\n#Classof((Grad Year)) #((Position))Recruiting #CollegeFootball",
    "I don't need to be the loudest guy in the room. Just the most prepared.\n\n#Classof((Grad Year)) #CollegeFootball #Mindset",
    "The grind is lonely sometimes. That's exactly what makes it worth something.\n\n#Classof((Grad Year)) #((Position)) #CollegeFootball",
    "Locked in on what I can control: effort, preparation, and attitude. Everything else takes care of itself.\n\n#Classof((Grad Year)) #CollegeFootball",
  ],
  team: [
    "This team works harder than anything I could capture in a post. Grateful to compete with them every day.\n\n#((High School)) #Classof((Grad Year)) #CollegeFootball",
    "Best thing about this team: nobody needs a title to lead. Everyone holds the standard.\n\n#((High School)) #Classof((Grad Year))",
    "We don't just play together — we develop each other. That's what makes this program worth something.\n\n#((High School)) #Classof((Grad Year)) #CollegeFootball",
    "Win or lose, I'd run through a wall for the guys in that locker room.\n\n#((High School)) #Classof((Grad Year))",
    "The culture at ((High School)) is real. Not something you post about — something you feel every day.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Practice was hard today. Better for it. That's what good teammates do — they push you.\n\n#((High School)) #Classof((Grad Year)) #CollegeFootball",
    "Not everyone on this team will get recruited. Every one of them competes like they will. That's why I love this group.\n\n#((High School)) #Classof((Grad Year))",
    "The bond in this locker room is what I'll miss most when it's over. Plenty of time for that later — right now there's work to do.\n\n#((High School)) #Classof((Grad Year)) #CollegeFootball",
    "My teammates make me better. That's the highest compliment I know how to give.\n\n#((High School)) #Classof((Grad Year))",
    "Every day in practice I'm going against the best competition I know. ((High School)) doesn't take days off.\n\n#Classof((Grad Year)) #CollegeFootball",
    "The guys around me raise my standard every week. That's what a good program does.\n\n#((High School)) #Classof((Grad Year)) #CollegeFootball",
  ],
  offseason: [
    "7-on-7 this weekend. Competing against top talent and loving every rep.\n\n#Classof((Grad Year)) #((Position))Recruiting #CollegeFootball",
    "Spring ball is in full effect. Building the foundation before the season opens.\n\n#Classof((Grad Year)) #((Position)) #CollegeFootball",
    "Showcase this weekend. Ready to compete and put some things on tape.\n\n#Classof((Grad Year)) #((Position))Recruiting #RecruitMe",
    "Offseason is where I separate myself. Nobody's watching. That's exactly when the real work happens.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Summer grind is in full effect. Camp schedule is locked in. Let's work.\n\n#Classof((Grad Year)) #((Position))Recruiting",
    "7-on-7 recap: went against some division-1 bound guys today. Held my own. That's all the confirmation I needed.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Spring eval visits starting. Taking notes on every program I step foot in.\n\n#Classof((Grad Year)) #RecruitMe #CollegeFootball",
    "Camp report: put my numbers in front of coaches today. The conversations were real.\n\n#Classof((Grad Year)) #((Position))Recruiting",
    "The offseason is where the gap closes — or widens. I know which one I'm choosing.\n\n#Classof((Grad Year)) #CollegeFootball",
    "Finished my last combine of the spring. Happy with the numbers. Happier with the film I put on tape.\n\n#Classof((Grad Year)) #((Position)) #CollegeFootball",
    "Summer is here. The offers that come out of this summer are earned in June and July. I'm showing up.\n\n#Classof((Grad Year)) #CollegeFootball #((Position))Recruiting",
    "Unofficial visits, 7-on-7, film updates. Summer recruiting is a full-time job and I'm treating it that way.\n\n#Classof((Grad Year)) #RecruitMe",
    "Ran a personal best at the combine today. Numbers are trending in the right direction.\n\n#Classof((Grad Year)) #((Position))Recruiting #CollegeFootball",
  ],
}

const GOAL = 3
const PAGE_SIZE = 3

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekKey(): string {
  const d = new Date()
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return `rr_posts_${monday.getFullYear()}_${String(monday.getMonth() + 1).padStart(2, "0")}_${String(monday.getDate()).padStart(2, "0")}`
}

function getWeeklyCount(): number {
  if (typeof window === "undefined") return 0
  return parseInt(localStorage.getItem(getWeekKey()) || "0", 10)
}

function incrementWeeklyCount(): number {
  const key = getWeekKey()
  const next = getWeeklyCount() + 1
  localStorage.setItem(key, String(next))
  return next
}

function resolvePost(text: string, profile: AthleteProfile): string {
  return text
    .replace(/\(\(Position\)\)/g, profile.position || "your position")
    .replace(/\(\(Grad Year\)\)/g, String(profile.grad_year || "your class"))
    .replace(/\(\(High School\)\)/g, profile.high_school || "your school")
    .replace(/\(\(Film Link\)\)/g, profile.hudl_url || "[your Hudl link]")
    .replace(/\(\(City\)\)/g, profile.city || "your city")
    .replace(/\(\(State\)\)/g, profile.state || "your state")
    .replace(/\(\(First Name\)\)/g, profile.first_name || "")
    .replace(/\(\(GPA\)\)/g, "[your GPA]")
}

// Stable daily shuffle — same order all day, different every day
function dailyShuffle<T>(arr: T[], categorySeed: number): T[] {
  const d = new Date()
  const seed =
    (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) ^
    categorySeed
  const out = [...arr]
  let s = seed
  for (let i = out.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 15), s | 1)
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61)
    s = (s ^ (s >>> 14)) >>> 0
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContentCalendar({ profile }: ContentCalendarProps) {
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].id)
  const [page, setPage] = useState(0)
  const [weeklyCount, setWeeklyCount] = useState(() => getWeeklyCount())
  // Track which post (by resolved text) was launched to X so we can show Done
  const [launchedText, setLaunchedText] = useState<string | null>(null)
  // Track texts confirmed as posted this session
  const [postedTexts, setPostedTexts] = useState<Set<string>>(new Set())

  const category = CATEGORIES.find((c) => c.id === selectedCategory)!

  const shuffled = useMemo(() => {
    const posts = POSTS[selectedCategory] ?? []
    const seed = selectedCategory.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    return dailyShuffle(posts, seed)
  }, [selectedCategory])

  const pageCount = Math.ceil(shuffled.length / PAGE_SIZE)
  const currentPosts = shuffled.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const handleCategoryChange = (id: string) => {
    setSelectedCategory(id)
    setPage(0)
    setLaunchedText(null)
  }

  const handleNext = () => {
    setPage((p) => (p + 1) % pageCount)
    setLaunchedText(null)
  }

  const handlePostOnX = (resolved: string) => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(resolved)}`
    window.open(url, "_blank", "noopener,noreferrer")
    setLaunchedText(resolved)
  }

  const handleDone = () => {
    if (!launchedText) return
    const next = incrementWeeklyCount()
    setWeeklyCount(next)
    setPostedTexts((prev) => new Set(prev).add(launchedText))
    setLaunchedText(null)
  }

  const isComplete = weeklyCount >= GOAL

  return (
    <Card className="overflow-hidden">
      <div className="p-5 sm:p-6">

        {/* Header + weekly counter */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
            Post on X
          </h3>
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
              isComplete
                ? "bg-green-100 text-green-700"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {isComplete ? (
              <>
                <Check className="h-3 w-3" />
                Week Complete
              </>
            ) : (
              <>{weeklyCount}/{GOAL} this week</>
            )}
          </div>
        </div>

        {/* Category pills */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryChange(cat.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Post options */}
        <div className="flex flex-col gap-2">
          {currentPosts.map((post, idx) => {
            const resolved = resolvePost(post, profile)
            const isLaunched = launchedText === resolved
            const isPosted = postedTexts.has(resolved)

            return (
              <div
                key={idx}
                className={`rounded-lg border p-3 transition-colors ${
                  isPosted ? "border-green-200 bg-green-50" : "bg-secondary/30"
                }`}
              >
                <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground" style={{ overflowWrap: "anywhere" }}>
                  {resolved}
                </p>

                {isPosted ? (
                  <div className="flex items-center justify-center gap-1.5 rounded-md bg-green-100 px-3 py-2 text-xs font-bold text-green-700">
                    <Check className="h-3 w-3" />
                    Posted
                  </div>
                ) : isLaunched ? (
                  <button
                    type="button"
                    onClick={handleDone}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-yellow-400 px-3 py-2 text-xs font-bold text-yellow-900 transition-colors hover:bg-yellow-500"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Click if you completed your post on X.
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePostOnX(resolved)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-xs font-bold text-background transition-colors hover:bg-foreground/80"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Post on X
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Next / more posts */}
        {pageCount > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary"
          >
            <RefreshCw className="h-3 w-3" />
            More {category.label} Posts
          </button>
        )}
      </div>
    </Card>
  )
}
