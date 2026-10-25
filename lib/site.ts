/** Site-wide settings. Empty strings are placeholders the author fills in (rendered as "coming soon"). */
export const SITE = {
  name: "InjectionShield",
  tagline: "Do prompt-injection detectors fail on Urdu?",
  description:
    "A research project and in-browser tool measuring whether open-source prompt-injection detectors fail on Urdu, Roman Urdu and Urdu-English code-mixed text, and testing a lightweight multilingual fix.",
  author: "Muhammad Shahzaib Khan",
  // TODO(author): fill these in before publishing.
  githubUrl: "https://github.com/mshahzaib7/injectionshield",
  email: "",
  liveUrl: "",
};

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/detector/", label: "Detector" },
  { href: "/research/", label: "Research" },
  { href: "/dataset/", label: "Dataset" },
  { href: "/about/", label: "About" },
];
