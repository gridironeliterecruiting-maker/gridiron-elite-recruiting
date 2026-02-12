# Mac Mini Migration Plan — OpenClaw + Gridiron Elite Recruiting

> Move Larry from AWS EC2 to a local Mac Mini with hybrid local/cloud AI setup.
> **Status:** Ready when Paul is. No rush.

**Last Updated:** 2026-02-12

---

## Hardware to Buy

**Mac Mini M4 Pro — 64GB Unified Memory / 512GB SSD — $1,599**

- Apple Store or Amazon
- 64GB RAM is critical — runs 70B parameter local models
- 512GB storage is plenty (workspace is <5GB, models are ~40GB)
- If budget allows, 1TB ($1,799) gives breathing room but not required

**Optional but nice:**
- Ethernet cable (faster than WiFi for always-on server)
- Small UPS battery backup (~$50) to survive brief power outages

---

## What Gets Installed on the Mac Mini

| Software | Purpose | Install Method |
|----------|---------|---------------|
| **Homebrew** | Package manager | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |
| **Node.js 22** | OpenClaw runtime | `brew install node@22` |
| **OpenClaw** | Me (Larry) | `npm install -g openclaw` |
| **Ollama** | Local AI model server | `brew install ollama` |
| **Git** | Version control | `brew install git` |
| **Llama 3.3 70B** | Primary local model | `ollama pull llama3.3:70b` |
| **Qwen 2.5 Coder 32B** | Code-focused model | `ollama pull qwen2.5-coder:32b` |

---

## Migration Steps

### Phase 1: Set Up the Mac Mini (~30 min)

1. **Unbox and connect** Mac Mini to power + ethernet
2. **macOS setup** — create user account, enable SSH:
   ```bash
   sudo systemsetup -setremotelogin on
   ```
3. **Install Homebrew + Node.js + Git:**
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   brew install node@22 git
   ```
4. **Install OpenClaw:**
   ```bash
   npm install -g openclaw
   ```
5. **Install Ollama + models:**
   ```bash
   brew install ollama
   ollama serve &
   ollama pull llama3.3:70b      # ~40GB download, takes a while
   ollama pull qwen2.5-coder:32b  # ~20GB download
   ```

### Phase 2: Copy Larry's Brain (~10 min)

From the AWS server, tar up the workspace and transfer:

```bash
# On AWS server
cd ~/.openclaw
tar czf larry-backup.tar.gz workspace/

# Transfer to Mac Mini (replace IP)
scp larry-backup.tar.gz user@macmini-ip:~/
```

On the Mac Mini:
```bash
mkdir -p ~/.openclaw
cd ~/.openclaw
tar xzf ~/larry-backup.tar.gz
```

This copies:
- All memory files (MEMORY.md, memory/*.md)
- SOUL.md, IDENTITY.md, USER.md, AGENTS.md, TOOLS.md
- TASKS.md, HEARTBEAT.md
- The entire gridiron-elite-recruiting codebase
- All docs, research, scripts

### Phase 3: Configure OpenClaw (~10 min)

```bash
openclaw init
```

Set up API keys:
- **Anthropic API key** (Claude — kept for heavy dev work)
- **Google API key** (Gemini Flash — kept for specific tasks)
- **Ollama endpoint** (http://localhost:11434 — for local models)

Configure the default model to use local Llama:
```
Default model: ollama/llama3.3:70b
Fallback/upgrade model: anthropic/claude-sonnet-4-20250514 (or opus when needed)
```

Set up credentials:
- **GitHub token** — same one from ~/.git-credentials
- **Supabase keys** — copy app/.env.local
- **Vercel token** — copy from app/.env.local

### Phase 4: Reconnect WhatsApp (~5 min)

```bash
openclaw whatsapp setup
```

- Scan new QR code with Paul's phone
- WhatsApp session transfers — old AWS connection auto-disconnects
- Test by sending a message

### Phase 5: Configure Hybrid Model Routing

In OpenClaw config, set up model routing:

| Task Type | Model | Cost |
|-----------|-------|------|
| **Default (conversation, edits, memory)** | ollama/llama3.3:70b | Free |
| **Code-heavy tasks** | ollama/qwen2.5-coder:32b | Free |
| **Complex dev (multi-file, architecture)** | anthropic/claude-sonnet-4-20250514 | API cost |
| **Heavy reasoning** | anthropic/claude-opus-4-6 | API cost |
| **Cron jobs, monitoring** | ollama/llama3.3:70b | Free |
| **Image analysis** | google/gemini-2.0-flash-lite | API cost (cheap) |

Paul can manually switch models with `/model` command when needed.

### Phase 6: Verify Everything Works (~10 min)

- [ ] Send/receive WhatsApp messages
- [ ] Read/write memory files
- [ ] Git push/pull to GitHub
- [ ] Vercel deploy works
- [ ] Supabase queries work
- [ ] Local model responds correctly
- [ ] Claude API works when switched to
- [ ] Cron jobs running (health monitor, spending monitor)
- [ ] Web search works

### Phase 7: Shut Down AWS (~5 min)

Once everything is verified on the Mac Mini:

1. Final backup of AWS server (just in case)
2. Stop EC2 instance
3. Wait a few days to make sure nothing's missing
4. Terminate EC2 instance
5. **$120/mo saved immediately**

---

## Keep the Mac Mini Always-On

macOS settings to prevent sleep:
```bash
# Prevent sleep when display is off
sudo pmset -a sleep 0
sudo pmset -a disksleep 0
sudo pmset -a displaysleep 5  # screen off after 5 min but Mac stays awake

# Auto-restart after power failure
sudo pmset -a autorestart 1
```

Set OpenClaw to start on boot:
```bash
# Create a launch agent
cat > ~/Library/LaunchAgents/com.openclaw.gateway.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.gateway</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/openclaw</string>
        <string>gateway</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF
```

---

## Cost Comparison (Monthly)

| | AWS + Full API | Mac Mini Hybrid |
|---|---|---|
| Server | $120 | $0 (owned hardware) |
| Claude API | $400-600 | $100-200 (complex tasks only) |
| Gemini | $30-60 | $15-30 |
| Local models | N/A | $0 (free) |
| Electricity | N/A | ~$8 |
| **Total** | **$550-780** | **$123-238** |

**Hardware payback: ~2 months**

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Internet goes out | Mac Mini works offline for local model tasks; API tasks queue until reconnected |
| Power outage | UPS battery ($50) gives 15-30 min; auto-restart on power restore |
| Mac Mini hardware failure | All code is on GitHub, memory files can be backed up to cloud |
| Local model quality not good enough | Keep Claude API as instant fallback — switch with one command |
| WhatsApp needs phone nearby | WhatsApp multi-device works independently after initial link |

---

## Timeline

| Step | Time | When |
|------|------|------|
| Order Mac Mini | — | Whenever ready |
| Unbox + macOS setup | 15 min | Day it arrives |
| Install software + download models | 30-45 min (mostly download time) | Same day |
| Copy workspace + configure | 20 min | Same day |
| Reconnect WhatsApp + verify | 15 min | Same day |
| Run in parallel with AWS for a few days | — | First week |
| Shut down AWS | 5 min | After confidence |
| **Total hands-on time** | **~1.5 hours** | — |

---

*Ready to execute whenever Paul pulls the trigger. All memory, code, and context transfers seamlessly.*
