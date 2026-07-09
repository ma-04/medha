-- Seed: the 10 standard BCS subjects and a starter set of topics.
-- Questions are seeded separately via scripts/seed-questions.mjs (bulk import).

insert into public.subjects (name_bn, name_en, slug, order_index) values
  ('বাংলা', 'Bangla', 'bangla', 1),
  ('English', 'English', 'english', 2),
  ('গণিত', 'Mathematics', 'math', 3),
  ('সাধারণ জ্ঞান – বাংলাদেশ', 'GK — Bangladesh', 'gk-bd', 4),
  ('সাধারণ জ্ঞান – আন্তর্জাতিক', 'GK — International', 'gk-intl', 5),
  ('সাধারণ বিজ্ঞান', 'General Science', 'science', 6),
  ('কম্পিউটার ও তথ্যপ্রযুক্তি', 'Computer & ICT', 'ict', 7),
  ('মানসিক দক্ষতা', 'Mental Ability', 'mental-ability', 8),
  ('ভূগোল ও পরিবেশ', 'Geography & Environment', 'geography', 9),
  ('নৈতিকতা ও সুশাসন', 'Ethics & Governance', 'ethics', 10)
on conflict (slug) do nothing;

-- A few topics per subject (enough to exercise practice mode).
insert into public.topics (subject_id, name_bn, name_en, slug, order_index)
select s.id, t.name_bn, t.name_en, t.slug, t.order_index
from public.subjects s
join (values
  ('bangla', 'ব্যাকরণ', 'Grammar', 'grammar', 1),
  ('bangla', 'সাহিত্য', 'Literature', 'literature', 2),
  ('english', 'Grammar', 'Grammar', 'grammar', 1),
  ('english', 'Vocabulary', 'Vocabulary', 'vocabulary', 2),
  ('math', 'পাটিগণিত', 'Arithmetic', 'arithmetic', 1),
  ('math', 'বীজগণিত', 'Algebra', 'algebra', 2),
  ('gk-bd', 'মুক্তিযুদ্ধ', 'Liberation War', 'liberation-war', 1),
  ('gk-bd', 'সংবিধান', 'Constitution', 'constitution', 2),
  ('gk-intl', 'আন্তর্জাতিক সংস্থা', 'International Orgs', 'intl-orgs', 1),
  ('science', 'পদার্থবিজ্ঞান', 'Physics', 'physics', 1),
  ('science', 'জীববিজ্ঞান', 'Biology', 'biology', 2),
  ('ict', 'কম্পিউটার মৌলিক', 'Computer Basics', 'computer-basics', 1),
  ('mental-ability', 'যুক্তি', 'Reasoning', 'reasoning', 1),
  ('geography', 'বাংলাদেশের ভূগোল', 'Geography of BD', 'bd-geography', 1),
  ('ethics', 'সুশাসন', 'Good Governance', 'governance', 1)
) as t(subject_slug, name_bn, name_en, slug, order_index)
  on t.subject_slug = s.slug
on conflict (subject_id, slug) do nothing;
