begin;

alter table public.profiles
drop constraint profiles_resume_pdf_url_check;

alter table public.profiles
add constraint profiles_resume_pdf_url_check check (
  resume_pdf_url is null
  or (
    (
      resume_pdf_url = id::text || '/resume.pdf'
      or resume_pdf_url like id::text || '/resume-%.pdf'
    )
    and resume_pdf_url not like '%/%/%'
  )
);

commit;
