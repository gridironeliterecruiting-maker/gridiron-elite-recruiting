-- Seed system email templates
-- Run this after 001_initial_schema.sql

-- Clear existing system templates (in case we run this multiple times)
DELETE FROM email_templates WHERE is_system = true;

-- Goal: Get a Response
INSERT INTO email_templates (name, subject, body, is_system) VALUES
('Introduction Email', 
'((First Name)), I''m Interested in Your Program',
'Dear Coach ((Last Name)),

My name is ((First Name)) ((Last Name)), and I''m a ((Position)) from ((High School)) in ((City)), ((State)). I''m reaching out because I''m very interested in your program at ((School)).

((Stats))

I''d love to learn more about your program and what you look for in recruits. My highlight film is available at: ((Film Link))

Thank you for your time!

((First Name)) ((Last Name))
((Phone))
((Email))',
true),

('Follow-Up #1',
'Following Up - ((First Name)) ((Last Name)), ((Position))',
'Coach ((Last Name)),

I wanted to follow up on my previous email about my interest in ((School)). I know you''re busy, but I''d really appreciate any feedback you might have.

I''ve been working hard on ((Improvement Area)) and recently ((Recent Achievement)).

My updated stats:
((Stats))

Film: ((Film Link))

Thank you for considering me!

((First Name)) ((Last Name))',
true),

('Follow-Up #2',
'Quick Update from ((First Name)) ((Last Name))',
'Hi Coach ((Last Name)),

I hope this finds you well. I wanted to share a quick update from my recent ((Recent Game/Event)).

((Recent Performance))

I''m still very interested in ((School)) and would love to know:
- What you look for in a ((Position))
- Your recruiting timeline
- If there''s anything specific you''d like to see from me

Thanks again for your time.

((First Name)) ((Last Name))
((Phone))',
true),

('Final Follow-Up',
'One More Try - ((First Name)) ((Last Name))',
'Coach ((Last Name)),

I understand you''re extremely busy, and I don''t want to be a bother. This will be my last email unless I hear back from you.

I remain very interested in ((School)) because ((Specific Reason)). If there''s any possibility of discussing your program, I''d be grateful for the opportunity.

If the timing isn''t right or you''re not interested, I completely understand. Either way, I appreciate you taking the time to read my emails.

Best of luck with your season!

((First Name)) ((Last Name))
((All Contact Info))',
true),

-- Goal: Evaluate Film
('Film Evaluation Request',
'((First Name)) ((Last Name)) - ((Position)) Film for Review',
'Coach ((Last Name)),

I wanted to share my latest film with you. I''ve had a strong season and would appreciate your evaluation.

((Film Link))

Key highlights:
((Stats))

I''d love to hear your thoughts on my performance and any areas where I can improve.

Thank you for taking the time to evaluate me!

((First Name)) ((Last Name))
((Phone))',
true),

-- Goal: Build Interest
('Personal Story',
'Why ((School)) Is My Top Choice',
'Coach ((Last Name)),

I wanted to share more about myself beyond the field. ((Personal Story))

Academically, I maintain a ((GPA)) GPA and am interested in studying ((Major)). I''ve researched your program extensively and I''m particularly drawn to ((Specific Program Aspect)).

I believe I''d be a great fit for your program both athletically and academically. I''d love to discuss how I can contribute to your team''s success.

Best regards,
((First Name)) ((Last Name))',
true),

('Academic Focus',
'My Academic Goals at ((School))',
'Coach ((Last Name)),

Beyond football, I''m serious about my education. With a ((GPA)) GPA, I''m looking for a program that values academics as much as athletics.

I''m interested in ((School))''s ((Major)) program and have already researched ((Professor/Program Detail)).

I''d love to learn more about how your student-athletes balance football and academics.

Thank you,
((First Name)) ((Last Name))',
true),

-- Goal: Secure Visit
('Visit Request',
'Campus Visit Opportunity - ((First Name)) ((Last Name))',
'Coach ((Last Name)),

Thank you for your interest in me as a recruit. I''m very excited about the possibility of joining your program.

I''d love to schedule a campus visit to meet you and the team. I''m available ((Availability)).

Please let me know what dates work best for you and if there''s anything specific I should prepare for the visit.

Looking forward to seeing your campus!

((First Name)) ((Last Name))
((Phone))',
true),

('Visit Confirmation',
'Confirming My Visit to ((School))',
'Coach ((Last Name)),

Thank you for inviting me to visit! I''m confirming my visit on ((Visit Date)).

Is there anything specific I should bring or prepare? I''m looking forward to:
- Meeting the coaching staff
- Touring the facilities  
- Talking with current players
- Learning about the academic support

Please let me know if you need any additional information from me.

See you soon!
((First Name)) ((Last Name))',
true),

-- Goal: Other (custom messages)
('Custom Message',
'',
'Coach ((Last Name)),



((First Name)) ((Last Name))',
true);