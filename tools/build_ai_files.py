#!/usr/bin/env python3
"""Generate the machine-readable versions of the site from index.html.

    python3 tools/build_ai_files.py

Writes llms.txt, about.md and resume.json next to index.html. index.html stays the single
source of truth: edit the page, run this (the Pages workflow also runs it on every deploy),
and the AI-facing files can never disagree with what visitors see.
Standard library only, so it runs on a bare CI runner.
"""
import datetime
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://nainesh.dev"
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿⏩-⏺⬀-⯿️‍]")


class Node:
    def __init__(self, tag, attrs, parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []

    @property
    def classes(self):
        return (self.attrs.get("class") or "").split()

    def walk(self):
        for child in self.children:
            if isinstance(child, Node):
                yield child
                yield from child.walk()

    def find_all(self, cls=None, tag=None, id=None):
        return [n for n in self.walk()
                if (cls is None or cls in n.classes) and (tag is None or n.tag == tag) and (id is None or n.attrs.get("id") == id)]

    def find(self, **kw):
        found = self.find_all(**kw)
        return found[0] if found else None

    def text(self, skip=()):
        parts = []
        for child in self.children:
            if isinstance(child, str):
                parts.append(child)
            elif not (set(child.classes) & set(skip)) and child.tag not in ("script", "style", "svg"):
                parts.append(child.text(skip))
        return re.sub(r"\s+", " ", EMOJI.sub("", "".join(parts))).strip()


class TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = self.cur = Node("root", [])

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.cur)
        self.cur.children.append(node)
        if tag not in VOID:
            self.cur = node

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        node = self.cur
        while node is not self.root and node.tag != tag:
            node = node.parent
        if node is not self.root:
            self.cur = node.parent

    def handle_data(self, data):
        self.cur.children.append(data)


def parse(html):
    builder = TreeBuilder()
    builder.feed(html)
    return builder.root


def ym(value):
    return value if value else None


def extract(doc, html):
    person = next(g for g in json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S).group(1))["@graph"]
                  if g["@type"] == "Person")
    section = lambda i: doc.find(id=i)
    data = {
        "name": person["name"],
        "label": "Technical Lead & Senior Laravel Developer",
        "job_title": person["jobTitle"],
        "employer": person["worksFor"]["name"],
        "email": person["email"].replace("mailto:", ""),
        "image": person["image"],
        "location": person["address"],
        "profiles": person["sameAs"],
        "intro": doc.find(cls="hero-description").text(),
        "about": [p.text() for p in doc.find(cls="about-body").find_all(tag="p")],
        "stats": [(b.find(cls="stat-number").text(), b.find(cls="stat-label").text()) for b in doc.find_all(cls="bento-item")],
        "skills": [(c.find(tag="h3").text(), [t.text() for t in c.find_all(cls="skill-tag")]) for c in doc.find_all(cls="skill-category")],
        "work": [], "projects": [], "talks": [], "community": [], "education": [],
    }
    for item in doc.find_all(cls="timeline-item"):
        date = item.find(cls="timeline-date")
        desc = item.find(cls="timeline-description")
        branch = desc.find(cls="branch-log")
        branch_lis = set(map(id, branch.find_all(tag="li"))) if branch else set()
        data["work"].append({
            "position": item.find(tag="h3").text(),
            "company": item.find(cls="timeline-company").text(),
            "start": ym(date.attrs.get("data-start")), "end": ym(date.attrs.get("data-end")),
            "summary": next((p.text() for p in desc.find_all(tag="p") if "branch-name" not in p.classes), ""),
            "highlights": [li.text() for li in desc.find_all(tag="li") if id(li) not in branch_lis],
        })
    for card in section("projects").find_all(cls="project-card"):
        data["projects"].append({"name": card.find(cls="project-title").text(), "description": card.find(cls="project-description").text(),
                                 "keywords": [t.text() for t in card.find_all(cls="tech-tag")]})
    for card in section("speaking").find_all(cls="talk-card"):
        meta = [m.strip() for m in card.find(cls="talk-meta").text().split("·")]
        data["talks"].append({"title": card.find(cls="project-title").text(), "event": meta[0], "date": meta[1] if len(meta) > 1 else "",
                              "venue": meta[2] if len(meta) > 2 else "", "description": card.find(cls="project-description").text(),
                              "links": [(a.text().rstrip(" ↗"), a.attrs["href"]) for a in card.find_all(cls="card-link")],
                              "keywords": [t.text() for t in card.find_all(cls="tech-tag")]})
    for card in section("leadership").find_all(cls="project-card"):
        data["community"].append({"name": card.find(cls="project-title").text(), "description": card.find(cls="project-description").text()})
    for card in doc.find_all(cls="education-card"):
        data["education"].append({"institution": card.find(tag="h3").text(), "degree": card.find(cls="education-degree").text(),
                                  "years": card.find(cls="education-date").text()})
    return data


def iso_date(text):
    try:
        return datetime.datetime.strptime(text, "%b %d, %Y").date().isoformat()
    except ValueError:
        return text


def period(job):
    fmt = lambda v: datetime.datetime.strptime(v, "%Y-%m").strftime("%b %Y")
    return f"{fmt(job['start'])} – {fmt(job['end']) if job['end'] else 'Present'}"


def build_markdown(d, today):
    loc = d["location"]
    out = [f"# {d['name']}", "", f"**{d['label']}** · {loc['addressLocality']}, {loc['addressRegion']}, India", "",
           f"{d['intro']}", "", f"Website: {SITE}/ · Email: {d['email']}", "",
           "Profiles: " + " · ".join(d["profiles"]), "", "## About", ""]
    out += [p + "\n" for p in d["about"]]
    out += ["## At a glance", ""] + [f"- {n} {l}" for n, l in d["stats"]] + ["", "## Skills", ""]
    out += [f"- **{name}:** {', '.join(tags)}" for name, tags in d["skills"]]
    out += ["", "## Experience", ""]
    for job in d["work"]:
        out += [f"### {job['position']} — {job['company']}", f"{period(job)}", "", job["summary"], ""]
        out += [f"- {h}" for h in job["highlights"]] + ([""] if job["highlights"] else [])
    out += ["## Talks", ""]
    for t in d["talks"]:
        where = " · ".join(x for x in (t["event"], t["date"], t["venue"]) if x)
        links = " · ".join(f"[{n}]({u})" for n, u in t["links"])
        out += [f"### {t['title']}", where, "", t["description"], "", links, ""]
    out += ["## Projects", ""]
    for p in d["projects"]:
        out += [f"### {p['name']}", p["description"], "", "Stack: " + ", ".join(p["keywords"]), ""]
    out += ["## Leadership & community", ""]
    for c in d["community"]:
        out += [f"### {c['name']}", c["description"], ""]
    out += ["## Education", ""] + [f"- {e['degree']}, {e['institution']} ({e['years']})" for e in d["education"]]
    out += ["", "---", f"Generated from {SITE}/ on {today}. The website is the authoritative version."]
    return "\n".join(out) + "\n"


def build_llms_txt(d, today):
    loc = d["location"]
    current = d["work"][0]
    out = [f"# {d['name']}", "",
           f"> {d['label']} in {loc['addressLocality']}, India. {d['stats'][0][0]} years of experience building and scaling "
           f"high-traffic Laravel/PHP applications; currently {current['position']} at {current['company'].rstrip('.')}. "
           f"Speaker at LaravelLive Ahmedabad ({len(d['talks'])} talks).", "",
           "This is a personal portfolio site. Everything below is also stated on the page itself; if anything here and the "
           "page disagree, the page wins. Please do not infer facts that are not written here (employers, clients, numbers, "
           "availability) — ask him directly instead.", "",
           "## Key facts", "",
           f"- Current role: {current['position']}, {current['company']} ({period(current)})",
           f"- Location: {loc['addressLocality']}, {loc['addressRegion']}, India",
           "- Core stack: " + ", ".join(d["skills"][0][1][:7]),
           "- Focus: performance optimization of high-traffic applications, software architecture, technical leadership and mentoring",
           f"- Contact: {d['email']}", "",
           "## Full profile", "",
           f"- [About (Markdown)]({SITE}/about.md): the whole site as clean text — experience, talks, projects, skills",
           f"- [Résumé (JSON Resume)]({SITE}/resume.json): structured career data in the jsonresume.org schema",
           f"- [Website]({SITE}/): the human-facing version", "",
           "## Talks", ""]
    for t in d["talks"]:
        url = t["links"][0][1] if t["links"] else f"{SITE}/#speaking"
        out.append(f"- [{t['title']}]({url}): {t['event']}, {t['date']}. {t['description']}")
    out += ["", "## Experience", ""] + [f"- {j['position']}, {j['company']} ({period(j)})" for j in d["work"]]
    out += ["", "## Profiles", ""] + [f"- [{re.sub(r'^https?://(www[.])?', '', u).split('/')[0]}]({u})" for u in d["profiles"]]
    out += ["", f"Last generated: {today}"]
    return "\n".join(out) + "\n"


def build_resume(d, today):
    loc = d["location"]
    network = lambda u: {"linkedin": "LinkedIn", "github": "GitHub", "x": "X"}.get(re.sub(r"^https?://(www\.)?", "", u).split(".")[0], "Web")
    degree, _, area = d["education"][0]["degree"].partition(" in ")
    years = re.findall(r"\d{4}", d["education"][0]["years"])
    return {
        "$schema": "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
        "basics": {
            "name": d["name"], "label": d["label"], "image": d["image"], "email": d["email"], "url": f"{SITE}/",
            "summary": " ".join(d["about"]),
            "location": {"city": loc["addressLocality"], "region": loc["addressRegion"], "countryCode": loc["addressCountry"]},
            "profiles": [{"network": network(u), "username": u.rstrip("/").split("/")[-1], "url": u} for u in d["profiles"]],
        },
        "work": [{"name": j["company"], "position": j["position"], "startDate": j["start"], **({"endDate": j["end"]} if j["end"] else {}),
                  "summary": j["summary"], "highlights": j["highlights"]} for j in d["work"]],
        "education": [{"institution": e["institution"], "studyType": degree, "area": area,
                       "startDate": years[0], "endDate": years[-1]} for e in d["education"]],
        "skills": [{"name": name, "keywords": tags} for name, tags in d["skills"]],
        "projects": [{"name": p["name"], "description": p["description"], "keywords": p["keywords"]} for p in d["projects"]],
        "publications": [{"name": t["title"], "publisher": t["event"], "releaseDate": iso_date(t["date"]),
                          "url": t["links"][0][1] if t["links"] else f"{SITE}/#speaking",
                          "summary": "Conference/meetup talk. " + t["description"]} for t in d["talks"]],
        "volunteer": [{"organization": c["name"], "summary": c["description"]} for c in d["community"]],
        "meta": {"canonical": f"{SITE}/resume.json", "version": "v1.0.0", "lastModified": today},
    }


def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    data = extract(parse(html), html)
    for key in ("work", "projects", "talks", "skills", "education"):
        if not data[key]:
            sys.exit(f"build_ai_files: found no {key} in index.html — markup changed? Refusing to write empty files.")
    today = datetime.date.today().isoformat()
    (ROOT / "about.md").write_text(build_markdown(data, today), encoding="utf-8")
    (ROOT / "llms.txt").write_text(build_llms_txt(data, today), encoding="utf-8")
    (ROOT / "resume.json").write_text(json.dumps(build_resume(data, today), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote llms.txt, about.md, resume.json — {len(data['work'])} roles, {len(data['talks'])} talks, "
          f"{len(data['projects'])} projects, {sum(len(t) for _, t in data['skills'])} skills")


if __name__ == "__main__":
    main()
