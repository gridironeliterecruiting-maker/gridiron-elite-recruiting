-- Baseline config/system data that must exist in every environment (prod + local).
-- Pulled from production (project ufmzldfkdpjeyvjfpoid) via Supabase MCP on 2026-04-19.
-- Contains the 5 pipeline stages, 19 system email templates, and 2 safe system_settings.
--
-- NOTE: prod's system_settings also holds live secrets (zoho_refresh_token, cron_secret,
-- inbox_diag, zoho_health_last_check, process_queue_url). Those are intentionally NOT
-- copied to local. Instead, local gets safe stub values, and email_sending_enabled is
-- hard-forced to 'false' so no dev database ever sends real mail.

-- ================================================================
-- PIPELINE STAGES (global, 5 rows)
-- ================================================================
INSERT INTO public.pipeline_stages (id, name, display_order, description) VALUES
  ('465322aa-2949-4b82-8f5b-e2b694f8f8df'::uuid, 'Initial Contact', 1, 'Exchange communication, fill out questionnaire, connect with area recruiting coach'),
  ('78341d3e-5f35-4981-a9ad-2b8124c896ee'::uuid, 'Evaluation',      2, 'Coach watched film, passed to position coach'),
  ('6dd80536-731a-4c18-8f0c-0f791c1d278f'::uuid, 'Interest',        3, 'Coach engages, builds relationship, invites to campus, asks for more film'),
  ('67dbab91-6ec6-418c-964c-af943f7b8cc9'::uuid, 'Campus Visit',    4, 'Junior day, game day visit, official visit'),
  ('79ece3cb-2de0-4bc9-9c6d-12f09a370ac2'::uuid, 'Offer',           5, 'Received an offer from the program');

-- ================================================================
-- SYSTEM EMAIL TEMPLATES (is_system = true, 19 rows)
-- ================================================================
INSERT INTO public.email_templates (id, name, subject, body, is_system, for_role) VALUES
  ('00b5fc01-2864-49c4-bd73-7930c0d1711a'::uuid, 'After Receiving an Offer', 'Thank You for the Offer — ((Player First Name)) ((Player Last Name))', 'Dear Coach ((Coach Last Name)),

Thank you so much for extending an offer to me to play at ((School Name with The)). This means a great deal to me and my family.

I want to take the time to make a thoughtful decision, and I plan to visit campus and speak with your staff to learn everything I can about the program.

I will be in touch soon. Thank you again for believing in me.

((Player First Name)) ((Player Last Name))
((Player Phone))
((Player Email))', true, 'player'),
  ('b765530b-9b40-44fa-a806-1ed354b9a0be'::uuid, 'Camp Interest', 'Camp Registration Interest — ((Player First Name)) ((Player Last Name))', 'Dear Coach ((Coach Last Name)),

I am very interested in attending an upcoming camp at ((School Name with The)). Could you provide me with information on camp dates and registration?

I would love the chance to compete in front of your coaching staff. Here is my highlight film for reference: ((Player Film Link))

((Player First Name)) ((Player Last Name)) | ((Player Position)) | Class of ((Player Grad Year))

Thank you for your time.

((Player First Name)) ((Player Last Name))
((Player Phone))
((Player Email))', true, 'player'),
  ('91a8e416-49ee-4dd5-9235-67ab19ecf4ba'::uuid, 'Camp Recommendation', 'Camp Recommendation — ((Player First Name)) ((Player Last Name)) | ((Player Position))', 'Coach ((Coach Last Name)),

I am writing to strongly recommend ((Player First Name)) ((Player Last Name)) for an upcoming camp at ((School Name with The)). ((Player First Name)) is a ((Player Position)) in the Class of ((Player Grad Year)) who is eager to compete in front of your staff.

I have coached ((Player First Name)) for several years and can tell you that the effort, coachability, and character are among the best I have worked with. The physical tools are there — I just want to make sure your staff gets a chance to see them in person.

Highlight film: ((Player Film Link))

Please let me know if there is anything I can do to help make this happen.

((My First Name))
((Player High School))', true, 'coach'),
  ('efb06350-7f2d-431b-997a-f72ffe8abc85'::uuid, 'Film Recommendation', 'Film to Review — ((Player First Name)) ((Player Last Name)) | ((Player Position)) | Class of ((Player Grad Year))', 'Coach ((Coach Last Name)),

I wanted to pass along updated film on one of my players, ((Player First Name)) ((Player Last Name)). ((Player First Name)) is a ((Player Position)) in the Class of ((Player Grad Year)) who I believe has the ability to contribute at ((School Name with The)).

Film: ((Player Film Link))

((Player First Name)) has been putting in serious work this offseason and the film speaks for itself. I am happy to provide any additional information or get on the phone with your staff at any time.

((My First Name))
((Player High School))', true, 'coach'),
  ('88099496-5dec-453a-b208-3fb48bc3deb3'::uuid, 'Film Share', 'Updated Film — ((Player First Name)) ((Player Last Name)) | ((Player Position)) | Class of ((Player Grad Year))', 'Coach ((Coach Last Name)),

I wanted to share my latest highlight film with you. I have had a strong offseason and believe this film reflects the work I have put in.

((Player Film Link))

((Player First Name)) ((Player Last Name)) | ((Player Position)) | Class of ((Player Grad Year)) | ((Player High School))
GPA: ((Player GPA))

I look forward to hearing your thoughts.

((Player First Name)) ((Player Last Name))
((Player Phone))', true, 'player'),
  ('61c51731-7aa3-4309-8529-7962e0251e37'::uuid, 'Final Follow-Up', 'Final Message — ((Player First Name)) ((Player Last Name))', 'Coach ((Coach Last Name)),

I understand you are extremely busy, so I will keep this brief. This will be my last follow-up unless I hear back from you.

I remain very interested in ((School Name with The)). My film: ((Player Film Link))

If the timing is not right, I completely understand. Thank you for taking the time to read my emails.

((Player First Name)) ((Player Last Name))
((Player Phone))
((Player Email))', true, 'player'),
  ('7d27b9fa-90b7-48c1-b52f-5d3b84ff98d2'::uuid, 'Final Follow-Up', 'Final Note — ((Player First Name)) ((Player Last Name)) | ((Player Position))', 'Coach ((Coach Last Name)),

I will keep this brief — this will be my last email unless I hear back from you regarding ((Player First Name)) ((Player Last Name)).

((Player First Name)) is a ((Player Position)) in the Class of ((Player Grad Year)) with strong character, a ((Player GPA)) GPA, and the film to compete at the next level.

Film: ((Player Film Link))

If ((School Name with The)) is not a fit right now, I completely understand. I wish you and your program the best of luck this season. Should your recruiting situation change, I would welcome the conversation.

((My First Name))
((Player High School))', true, 'coach'),
  ('a5fe6b6a-77e6-4460-b898-ab7213492012'::uuid, 'Follow-Up #1', 'Following Up — ((Player First Name)) ((Player Last Name)) | ((Player Position))', 'Dear Coach ((Coach Last Name)),

I wanted to follow up on my previous email about my interest in ((School Name with The)). I know you are busy, but I would really appreciate hearing from you.

I remain committed to improving every day and have updated film available at: ((Player Film Link))

Thank you again for your time.

Best regards,
((Player First Name)) ((Player Last Name))
((Player Phone))', true, 'player'),
  ('1f780256-00f7-4be8-9438-758628ded97f'::uuid, 'Follow-Up #2', 'Second Follow-Up — ((Player First Name)) ((Player Last Name)) | ((Player Position))', 'Coach ((Coach Last Name)),

I apologize for the persistence, but I want to make sure ((Player First Name)) ((Player Last Name)) stays on your radar. I sent a couple of emails over the past few weeks and just wanted to circle back one more time.

((Player First Name)) is a ((Player Position)) in the Class of ((Player Grad Year)) out of ((Player High School)). The work ethic and character are exceptional, and the film has continued to improve.

Latest film: ((Player Film Link))
GPA: ((Player GPA))

I genuinely believe ((Player First Name)) can contribute to your program at ((School Name with The)). If there is any interest or questions, I am happy to jump on a call at your convenience.

((My First Name))
((Player High School))', true, 'coach'),
  ('db972723-36b5-4af3-af4e-38abc4877b14'::uuid, 'Follow-Up #2', 'Quick Update — ((Player First Name)) ((Player Last Name))', 'Coach ((Coach Last Name)),

I hope this finds you well. I wanted to reiterate my strong interest in ((School Name with The)) and share a quick update.

I continue to work hard this offseason. My latest film is available here: ((Player Film Link))

I would love to know more about your recruiting timeline and what you look for in a ((Player Position)). Please let me know if there is anything specific you would like to see from me.

Thank you,
((Player First Name)) ((Player Last Name))
((Player Phone))', true, 'player'),
  ('05e4b8e8-fb84-4029-a8bd-8ee5c9fb99fe'::uuid, 'Follow-Up Recommendation', 'Following Up — ((Player First Name)) ((Player Last Name)) | ((Player Position))', 'Coach ((Coach Last Name)),

I wanted to follow up on my earlier email regarding ((Player First Name)) ((Player Last Name)). I know recruiting season is busy, so I just wanted to make sure my message did not slip through the cracks.

((Player First Name)) continues to work hard and is generating interest from several programs. I believe ((School Name with The)) would be an excellent fit and wanted to make sure you had a chance to evaluate ((Player First Name)) before your board fills up.

Updated film: ((Player Film Link))

Happy to answer any questions.

((My First Name))
((Player High School))', true, 'coach'),
  ('23d98616-6253-4642-af1f-71e58cb5ca7e'::uuid, 'Initial Introduction', 'Introduction — ((Player First Name)) ((Player Last Name)) | ((Player Position)) | Class of ((Player Grad Year))', 'Dear Coach ((Coach Last Name)),

My name is ((Player First Name)) ((Player Last Name)) and I am a ((Player Position)) in the Class of ((Player Grad Year)) at ((Player High School)) in ((Player City)), ((Player State)).

I am very interested in ((School Name with The)) and your football program. I would love the opportunity to learn more about your program and what it would take to be a part of your team.

Here is a link to my highlight film: ((Player Film Link))

GPA: ((Player GPA))

Thank you for your time, and I look forward to hearing from you.

Sincerely,
((Player First Name)) ((Player Last Name))
((Player Phone))
((Player Email))', true, 'player'),
  ('c4ed8be3-2f67-4b5f-97cb-6d2871ff1d2b'::uuid, 'Offer Response', 'Regarding the Offer to ((Player First Name)) ((Player Last Name))', 'Coach ((Coach Last Name)),

Thank you for extending an offer to ((Player First Name)) ((Player Last Name)). It is a testament to the quality of your program and your staff''s ability to evaluate talent.

((Player First Name)) and the family are taking the decision seriously and will be in touch with your program directly to discuss next steps.

I remain available to answer any questions about ((Player First Name))''s character, work ethic, or on-field development.

((My First Name))
((Player High School))', true, 'coach'),
  ('d455a12b-1422-40e9-be34-b5585364ccf4'::uuid, 'Player Introduction', 'Player Recommendation — ((Player First Name)) ((Player Last Name)) | ((Player Position)) | Class of ((Player Grad Year))', 'Coach ((Coach Last Name)),

My name is ((My First Name)) and I am reaching out to recommend one of my players, ((Player First Name)) ((Player Last Name)), a ((Player Position)) in the Class of ((Player Grad Year)) at ((Player High School)) in ((Player City)), ((Player State)).

((Player First Name)) is an outstanding student-athlete who I believe would be a strong fit for your program at ((School Name with The)). I have had the privilege of coaching ((Player First Name)) and can speak to both the athletic ability and the character that would make a great addition to your team.

Highlight film: ((Player Film Link))
GPA: ((Player GPA))

I would welcome the opportunity to discuss ((Player First Name))''s potential with you. Please do not hesitate to reach out.

Sincerely,
((My First Name))
((Player High School))', true, 'coach'),
  ('57d4be77-f9dd-4767-bfea-1dc346d3aff8'::uuid, 'Post-Camp Thank You', 'Thank You — ((Player First Name)) ((Player Last Name)) at ((School Name)) Camp', 'Coach ((Coach Last Name)),

I wanted to reach out and thank you and your staff for hosting ((Player First Name)) ((Player Last Name)) at your recent camp. It was a tremendous opportunity and ((Player First Name)) came away from the experience with nothing but positive things to say about your program and your coaches.

I believe the camp was a chance for your staff to see firsthand what ((Player First Name)) can do. ((Player First Name)) is a ((Player Position)) in the Class of ((Player Grad Year)) who I believe has what it takes to compete at ((School Name with The)).

Film: ((Player Film Link))

Please do not hesitate to reach out if you have any questions or would like to discuss ((Player First Name)) further.

((My First Name))
((Player High School))', true, 'coach'),
  ('b55105b8-3aae-4770-ba79-65241f1a2d4a'::uuid, 'Post-Camp Thank You', 'Thank You — ((Player First Name)) ((Player Last Name)) | ((School Name)) Camp', 'Dear Coach ((Coach Last Name)),

Thank you for the opportunity to attend camp at ((School Name with The)). I had a tremendous experience and thoroughly enjoyed learning from your coaching staff.

Competing at your facility has only strengthened my desire to be part of your program. I am excited about the possibility of contributing to ((School Name with The)) in the future.

Please let me know if there is anything else you need from me.

Best regards,
((Player First Name)) ((Player Last Name))
((Player Phone))
((Player Email))', true, 'player'),
  ('04c8b033-ed4c-4573-955d-448c50d8e695'::uuid, 'Post-Visit Thank You', 'Thank You — ((Player First Name)) ((Player Last Name)) Visit to ((School Name))', 'Coach ((Coach Last Name)),

I wanted to reach out and thank you and your staff for hosting ((Player First Name)) ((Player Last Name)) on their visit to ((School Name with The)). The experience made a real impression and ((Player First Name)) came away very excited about the program.

Please know that ((Player First Name)) is a hard worker both on and off the field, and I could not give a stronger endorsement.

Feel free to reach out to me directly with any questions.

((My First Name))
((Player High School))', true, 'coach'),
  ('0a3fd29c-19cd-46d4-a73c-259f2951c079'::uuid, 'Visit Request', 'Campus Visit Request — ((Player First Name)) ((Player Last Name))', 'Dear Coach ((Coach Last Name)),

Thank you for your continued interest in me as a recruit. I am very excited about the possibility of joining your program at ((School Name with The)).

I would love to schedule a campus visit to meet you, your staff, and the team. Seeing the program and facilities firsthand would mean a lot to me as I make my college decision.

Please let me know what dates and times work best for your staff. I am flexible and will make myself available.

Thank you,
((Player First Name)) ((Player Last Name))
((Player Phone))
((Player Email))', true, 'player'),
  ('d451206a-5901-4748-bf58-b256a339dc72'::uuid, 'Visit Request', 'Campus Visit Request — ((Player First Name)) ((Player Last Name)) | ((Player Position))', 'Coach ((Coach Last Name)),

I am reaching out to request a campus visit opportunity for ((Player First Name)) ((Player Last Name)), a ((Player Position)) in the Class of ((Player Grad Year)) at ((Player High School)).

((Player First Name)) has a strong interest in ((School Name with The)) and I believe a visit would allow your staff to get a much better sense of who ((Player First Name)) is — both as a player and as a person. ((Player First Name)) has a ((Player GPA)) GPA and the kind of character that fits any locker room.

Film: ((Player Film Link))

We are flexible on timing and happy to work around your schedule. Please let me know if a visit is possible or if there is a better way to get ((Player First Name)) in front of your staff.

Thank you,
((My First Name))
((Player High School))', true, 'coach');

-- ================================================================
-- SYSTEM SETTINGS (local-safe only — prod secrets are NEVER mirrored here)
-- ================================================================
INSERT INTO public.system_settings (key, value) VALUES
  ('email_sending_enabled', 'false'),
  ('cron_secret',           'local-dev-cron-secret-do-not-use-in-prod');
