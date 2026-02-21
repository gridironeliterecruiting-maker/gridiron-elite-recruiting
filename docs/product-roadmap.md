# Gridiron Elite Recruiting - Product Roadmap

## Completed Features ✅
- User authentication (Google OAuth via Supabase)
- Dashboard with recruiting metrics
- Coach database integration
- Email campaign wizard (4-step UI)
- Gmail integration for sending emails
- Automatic Gmail token refresh
- Pipeline/CRM tracking
- Programs browser
- Staging environment setup

## Known Issues & Learnings

### OAuth/Authentication
**Issue:** Supabase URL briefly visible during Google OAuth login
**Investigation Date:** 2026-02-21
**Time Spent:** ~3 hours, $50 in API costs
**What We Learned:**
1. We can bypass Supabase OAuth and go direct to Google
2. This successfully removes the Supabase URL from Google's account picker
3. However, creating Supabase sessions after direct OAuth is complex
4. Attempting to generate magic links or manual session tokens doesn't work reliably
5. The security implications of custom session management are significant

**Options Evaluated:**
1. Direct Google OAuth (attempted, session creation failed)
2. Custom session management (too complex, security risks)
3. Supabase Pro with custom domain ($25/mo)
4. Accept current flow (chosen for now)

**Technical Details for Future Attempts:**
- Created `/api/auth/google` and `/api/auth/google/callback` endpoints
- Must add callback URLs to Google Console
- Environment variables GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET needed in Vercel
- Main challenge: Supabase's auth.signInWithIdToken doesn't work as expected
- Would need to implement custom session cookies matching Supabase's format

## Future Enhancements

### High Priority
1. **Clean OAuth Flow**
   - Option A: Implement Supabase Pro ($25/mo) for custom auth domain
   - Option B: Complete direct OAuth implementation with proper session management
   - Option C: Add loading overlay improvements to minimize URL visibility

2. **Email Deliverability**
   - Monitor Gmail sending limits
   - Consider Instantly.ai integration for scale
   - Add email warming features

3. **Mobile App**
   - React Native implementation
   - Push notifications for coach responses

### Medium Priority
1. **Analytics Dashboard**
   - Email open rates
   - Response tracking
   - Coach engagement metrics

2. **Team Features**
   - Multiple athletes per account
   - Coach sharing between teammates
   - Collaborative pipelines

3. **AI Features**
   - Smart coach recommendations
   - Email response analysis
   - Optimal send time predictions

### Low Priority
1. **Advanced Integrations**
   - Hudl highlight sync
   - Social media monitoring
   - College visit scheduler

2. **Gamification**
   - Recruiting progress badges
   - Leaderboards
   - Achievement system

## Technical Debt
1. Email sending architecture decision (direct Gmail vs Instantly.ai)
2. Supabase RLS policies need review
3. Error handling improvements needed
4. Test coverage is minimal