window.LOOM_DATA = window.LOOM_DATA || {};
window.LOOM_DATA["iliad-20"] = {
  meta: {
    id: "iliad-20",
    epic: "The Iliad",
    song: "Third Song",
    book: 20,
    title: "The Gods Enter the Field",
    subtitle: "Book Twenty - Zeus releases the gods, Aeneas is saved, and Achilles begins his slaughter",
    tagline: "Scene · five movements · divine factions, Aeneas, Polydorus, near-Hector · then the Ninth Hour",
    epigraph: {
      text: "When Achilles returns, even the gods must take their places before the storm.",
      src: "after Fagles, Iliad 20 - the gods entering battle. Paraphrase; not a verified quotation."
    }
  },

  recap: [
    "Achilles has reconciled with Agamemnon, received the gifts, heard Briseis mourn Patroclus, refused ordinary food, and accepted the death foretold by his horse. The old quarrel is over because a larger grief has swallowed it.",
    "Now Zeus opens the field. If Achilles fights unchecked, Troy itself may fall before its fated hour."
  ],

  scene: [
    "<span class='god'>Zeus</span> calls the gods to assembly and permits them to enter battle on whichever side they favor. The divine ban lifts, and the war's hidden loyalties become visible.",
    "Achilles comes on with a force so great the poem needs gods in motion simply to keep fate aligned. Aeneas will meet him and be saved, not because he wins, but because his line has a future beyond Troy's present ruin."
  ],

  terms: [
    { gk: "theomachy", def: "battle involving gods. Book 20 opens the door to divine combat and open divine alignment." },
    { gk: "genos", def: "lineage or race. Aeneas' survival matters because his family line is not meant to vanish here." },
    { gk: "lyssa", def: "battle-rage, almost wolfish frenzy. Achilles' grief has turned into a force that threatens order." }
  ],

  movements: [
    {
      n: "Movement I",
      title: "Zeus opens the war",
      what: "<p><span class='god'>Zeus</span> allows the gods to join the fighting. <span class='god'>Hera</span>, <span class='god'>Athena</span>, <span class='god'>Poseidon</span>, <span class='god'>Hermes</span>, and <span class='god'>Hephaestus</span> favor the Greeks; <span class='god'>Ares</span>, <span class='god'>Apollo</span>, <span class='god'>Artemis</span>, <span class='god'>Aphrodite</span>, and others stand with Troy.</p>",
      why: "Achilles' return raises the stakes so high divine management must become open."
    },
    {
      n: "Movement II",
      title: "Aeneas is driven forward",
      what: "<p><span class='god'>Apollo</span> urges <span class='who'>Aeneas</span> to face Achilles. Aeneas recounts his lineage, and the two throw spears, but Achilles is too much for him.</p>",
      why: "The duel tests heroic ancestry against Achilles' present fury. Lineage matters, but it does not make Aeneas equal to the man grief has unleashed."
    },
    {
      n: "Movement III",
      title: "Poseidon saves a Trojan",
      what: "<p><span class='god'>Poseidon</span>, though hostile to Troy, hides Aeneas in mist and carries him away because fate preserves Aeneas and his descendants.</p>",
      why: "Divine politics are not simple team loyalty. A god who hates Troy can save a Trojan when fate requires a future line."
    },
    {
      n: "Movement IV",
      title: "Polydorus and Hector's flare",
      what: "<p>Achilles kills <span class='who'>Polydorus</span>, a young son of Priam. <span class='who'>Hector</span>, enraged, rushes toward Achilles, but <span class='god'>Apollo</span> shields him from death too soon.</p>",
      why: "The poem delays the central encounter. Hector must feel the pull toward Achilles, but fate has not yet spent the intervening slaughter."
    },
    {
      n: "Movement V",
      title: "Achilles cuts through the plain",
      what: "<p>Achilles drives through Trojans in a terrible sequence of kills. Men fall before him as the battle moves toward the river.</p>",
      why: "The return is not heroic balance restored. It is an excess of force, and the landscape itself will soon resist it."
    }
  ],

  panels: [
    {
      label: "Why Aeneas lives",
      lines: [
        "Aeneas is not spared because he defeats Achilles.",
        "He is spared because the poem's horizon is larger than this day: some lines are marked to continue beyond Troy's fall."
      ]
    }
  ],

  characters: {
    "Mortals": [
      { name: "Achilles", epithet: "swift-footed", role: "Returns to battle with force that requires divine counterweights.", tag: "The unleashed grief" },
      { name: "Aeneas", epithet: "son of Anchises", role: "Faces Achilles and is saved by Poseidon for the sake of his future line.", tag: "The preserved line" },
      { name: "Hector", epithet: "breaker of horses", role: "Rushes toward Achilles after Polydorus dies, but Apollo prevents the fatal meeting too soon.", tag: "The delayed opponent" },
      { name: "Polydorus", epithet: "young son of Priam", role: "Killed by Achilles, provoking Hector's rage.", tag: "The spark before Hector" }
    ],
    "Gods & Powers": [
      { name: "Zeus", epithet: "cloud-gatherer", role: "Permits the gods to fight openly so fate can be managed around Achilles' return.", tag: "The opener of the field", god: true },
      { name: "Apollo", epithet: "lord of the silver bow", role: "Urges Aeneas and protects Hector from dying before his time.", tag: "The Trojan screen", god: true },
      { name: "Poseidon", epithet: "earth-shaker", role: "Saves Aeneas despite opposing Troy.", tag: "The keeper of a future", god: true },
      { name: "Athena", epithet: "grey-eyed", role: "Stands among the Greek-favoring gods as Achilles returns.", tag: "The Greek will", god: true }
    ]
  },

  threads: [
    { dir: "back", to: "iliad-19", title: "The death-bound return", note: "Achilles enters battle after hearing his own end named. Book 20 shows what that knowledge looks like when turned outward." },
    { dir: "back", to: "iliad-05", title: "Aeneas saved again", note: "Aeneas was rescued from Diomedes in Book 5. He is rescued from Achilles here for the same broad reason: his story is not allowed to end on this field." },
    { dir: "ahead", to: "iliad-21", title: "Toward the river", note: "Achilles' killing becomes so great that the next opponent will not be a man but the landscape itself." }
  ],

  quiz: [
    { n: "I · Divine release", kind: "event", q: "What does Zeus permit in Book 20?", opts: ["The gods may enter the battle openly", "All mortals must leave Troy", "Achilles must sail home", "No one may fight"], correct: 0, truth: "<b>The hidden alignments become visible.</b> Achilles' return forces divine management into the open." },
    { n: "II · Aeneas", kind: "event", q: "What happens when Aeneas faces Achilles?", opts: ["Aeneas kills Achilles", "Poseidon saves Aeneas because fate preserves his line", "Aeneas captures the ships", "Zeus turns him into a bird"], correct: 1, truth: "<b>Lineage survives where strength cannot.</b> Aeneas is not Achilles' equal, but he is not fated to die here." },
    { n: "III · Hector delayed", kind: "event", q: "Why does Hector not die in Book 20?", opts: ["Apollo shields him from Achilles before the appointed moment", "He never sees Achilles", "He leaves for Lycia", "Priam forbids him to fight"], correct: 0, truth: "<b>The meeting is postponed.</b> Hector is pulled toward Achilles, but the poem has not yet arrived at that death." },
    { n: "IV · Meaning of the slaughter", kind: "meaning", q: "What does Achilles' return feel like?", opts: ["A calm restoration of order", "An excess of grief-driven force that threatens order", "A comic trick", "A peaceful settlement"], correct: 1, truth: "<b>Achilles returns as storm, not balance.</b> The next book will show even the river resisting him." }
  ]
};
