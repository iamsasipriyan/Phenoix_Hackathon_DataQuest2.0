const categories = {
  Work: [
    "Team meeting",
    "Code development",
    "Client call",
    "Report preparation",
    "Bug fixing"
  ],
  Personal: [
    "Family time",
    "Grocery shopping",
    "Doctor visit",
    "Bill payments",
    "Personal planning"
  ],
  Hobby: [
    "Reading books",
    "Learning guitar",
    "Painting",
    "Photography",
    "Blog writing"
  ],
  Fun: [
    "Watching movies",
    "Gaming",
    "Friends meetup",
    "Social media",
    "Music time"
  ],
  Rest: [
    "Sleeping",
    "Meditation",
    "Power nap",
    "Relaxing",
    "Yoga"
  ]
};

const priorities = ["Low", "Medium", "High"];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateTasks(category, count) {
  const tasks = [];

  for (let i = 0; i < count; i++) {
    const startHour = randomInt(6, 20);
    const duration = randomInt(30, 180);

    tasks.push({
      id: `${category}-${i + 1}`,
      category,
      title: categories[category][randomInt(0, 4)],
      description: `${category} related activity`,
      startTime: `2025-01-${randomInt(1, 28)}T${startHour}:00`,
      endTime: `2025-01-${randomInt(1, 28)}T${startHour + 1}:00`,
      priority: priorities[randomInt(0, 2)],
      durationMinutes: duration
    });
  }

  return tasks;
}

const dataset = {
  Work: generateTasks("Work", 120),
  Personal: generateTasks("Personal", 110),
  Hobby: generateTasks("Hobby", 100),
  Fun: generateTasks("Fun", 105),
  Rest: generateTasks("Rest", 130)
};

console.log(JSON.stringify(dataset, null, 2));