window.LOOM_DATA = window.LOOM_DATA || {};
window.LOOM_DATA["iliad-19"] = {
  meta: {
    id: "iliad-19",
    epic: "The Iliad",
    song: "Third Song",
    book: 19,
    title: "The Return of Achilles",
    subtitle: "Book Nineteen - Achilles and Agamemnon reconcile, Briseis mourns, and the death-bound hero arms",
    tagline: "Scene · five movements · public repair, fasting grief, immortal horses · then the Ninth Hour",
    epigraph: {
      text: "The quarrel is ended, but not healed; grief has made Achilles larger and less human.",
      src: "after Fagles, Iliad 19 - Achilles' return to battle. Paraphrase; not a verified quotation."
    }
  },

  recap: [
    "Achilles learned that Patroclus was dead, chose to kill Hector despite Thetis' warning, and received new armor from Hephaestus. The shield he now owns holds the whole human world: peace and war, field and city, labor and dance.",
    "Before he can carry that world into slaughter, he must formally rejoin the Greek army and settle the old quarrel with Agamemnon."
  ],

  scene: [
    "At dawn <span class='god'>Thetis</span> brings the armor and preserves Patroclus' body from decay. Achilles calls an assembly, renounces the quarrel, and asks to fight at once. <span class='who'>Agamemnon</span> offers explanation, gifts, and the return of <span class='who'>Briseis</span>.",
    "The army wants food; Achilles wants only killing. Odysseus forces the practical order of gift-giving and eating, but Achilles remains outside ordinary appetite. Even his immortal horse will speak and tell him death is near."
  ],

  terms: [
    { gk: "atē", def: "delusion or ruinous blindness. Agamemnon uses it to explain his seizure of Briseis, shifting blame toward a force that overtook him." },
    { gk: "apoinia", def: "recompense or gifts of repair. The gifts matter politically, even though they cannot touch Achilles' true wound now." },
    { gk: "nēsteia", def: "fasting. Achilles refuses food because grief has cut him off from ordinary human maintenance." }
  ],

  movements: [
    {
      n: "Movement I",
      title: "The armor arrives",
      what: "<p><span class='god'>Thetis</span> lays the new armor before Achilles and preserves <span class='who'>Patroclus</span>' body. The bronze terrifies the Myrmidons, but Achilles looks at it with savage joy.</p>",
      why: "The armor is beautiful and dreadful because it answers grief with capacity for violence."
    },
    {
      n: "Movement II",
      title: "The quarrel is closed",
      what: "<p><span class='who'>Achilles</span> calls assembly and says he and <span class='who'>Agamemnon</span> should never have fought over Briseis. Agamemnon blames ruinous delusion and offers the promised gifts.</p>",
      why: "The public order is repaired, but the emotional order is not. Achilles no longer cares about the original insult because Patroclus is dead."
    },
    {
      n: "Movement III",
      title: "Odysseus insists on human sequence",
      what: "<p><span class='who'>Odysseus</span> insists that gifts be displayed, oaths sworn, and the army fed before battle. Achilles wants immediate slaughter, but the practical man forces ritual and food back into the day.</p>",
      why: "Odysseus protects the army from Achilles' inhuman grief. Men who fight must eat, even if Achilles wishes he were only vengeance."
    },
    {
      n: "Movement IV",
      title: "Briseis mourns Patroclus",
      what: "<p><span class='who'>Briseis</span> returns and finds Patroclus dead. She laments him as the one who comforted her after Achilles killed her family and promised to make her Achilles' lawful wife.</p>",
      why: "Briseis stops being only the prize that caused the quarrel. Her grief reveals Patroclus' kindness and the human cost hidden inside heroic possessions."
    },
    {
      n: "Movement V",
      title: "Xanthus speaks",
      what: "<p>As Achilles arms, his immortal horse <span class='who'>Xanthus</span> bows his head and speaks by Hera's gift, warning that Achilles' death is near. Achilles answers that he knows and goes anyway.</p>",
      why: "The poem removes suspense from Achilles' fate. What remains is choice: he rides toward a death he understands."
    }
  ],

  panels: [
    {
      label: "Reconciliation without cure",
      lines: [
        "The gifts are given. The oath is sworn. Briseis is returned.",
        "But the real loss is Patroclus, and no gift can recompense the dead."
      ]
    }
  ],

  characters: {
    "Mortals": [
      { name: "Achilles", epithet: "swift-footed son of Peleus", role: "Ends the quarrel and returns to battle, refusing food and accepting the nearness of death.", tag: "The fasting avenger" },
      { name: "Agamemnon", epithet: "lord of men", role: "Explains his earlier act through atē and gives the promised gifts.", tag: "The repaired king" },
      { name: "Odysseus", epithet: "man of tactics", role: "Forces public procedure and food before battle.", tag: "The guardian of order" },
      { name: "Briseis", epithet: "woman of Lyrnessus", role: "Mourns Patroclus and reveals his tenderness toward her.", tag: "The grief behind the prize" },
      { name: "Xanthus", epithet: "immortal horse of Achilles", role: "Speaks the nearness of Achilles' death.", tag: "The horse that foretells" }
    ],
    "Gods & Powers": [
      { name: "Thetis", epithet: "silver-footed", role: "Brings the armor and preserves Patroclus' body.", tag: "The mother with bronze", god: true },
      { name: "Athena", epithet: "grey-eyed", role: "Feeds Achilles divine sustenance when he refuses mortal food.", tag: "The hidden nourisher", god: true },
      { name: "Hera", epithet: "queen of Olympus", role: "Allows Xanthus to speak, making Achilles' fate audible.", tag: "The voice-giver", god: true }
    ]
  },

  threads: [
    { dir: "back", to: "iliad-01", title: "The quarrel's public end", note: "The anger born in Book 1 is formally closed, but the poem is honest: repair comes too late to restore what anger helped cost." },
    { dir: "back", to: "iliad-09", title: "Gifts after they no longer matter", note: "The gifts refused in Book 9 are now given, but their meaning has changed. Achilles returns for Patroclus, not for recompense." },
    { dir: "ahead", to: "iliad-22", title: "The death he knows", note: "Xanthus says what Thetis already said: Achilles' road runs through Hector and then toward his own end." }
  ],

  quiz: [
    { n: "I · Public repair", kind: "event", q: "What does Achilles do in assembly?", opts: ["Renounces the quarrel with Agamemnon and asks to fight", "Declares himself king of Troy", "Accuses Patroclus", "Sails home"], correct: 0, truth: "<b>The quarrel closes publicly.</b> It is repaired politically, but grief remains untreated." },
    { n: "II · Atē", kind: "meaning", q: "How does Agamemnon explain his seizure of Briseis?", opts: ["As ruinous delusion or atē overtaking him", "As Achilles' command", "As a Trojan trick", "As a dream from Patroclus"], correct: 0, truth: "<b>Agamemnon shifts the frame.</b> Atē names the blindness that made his act disastrous." },
    { n: "III · Briseis", kind: "event", q: "Whom does Briseis mourn when she returns?", opts: ["Patroclus", "Paris", "Dolon", "Sarpedon"], correct: 0, truth: "<b>The prize has a voice.</b> Briseis remembers Patroclus as kind to her after terrible losses." },
    { n: "IV · Xanthus", kind: "thread", q: "What does Achilles' horse Xanthus reveal?", opts: ["Achilles will live forever", "Achilles' death is near", "Hector is already dead", "The war is a dream"], correct: 1, truth: "<b>No suspense, only choice.</b> Achilles knows the cost and goes anyway." }
  ]
};
