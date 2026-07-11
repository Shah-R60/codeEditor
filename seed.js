const firstNames = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"];

async function seed() {
  const jobId = "b56ace51-5557-4833-9936-74cfb9c1c772";
  const url = `http://localhost:3001/db/jobs/${jobId}/candidates`;

  console.log(`Seeding 20 candidates for job ${jobId}...`);

  for (let i = 0; i < 20; i++) {
    const name = `${firstNames[i]} ${lastNames[i]}`;
    const email = `${firstNames[i].toLowerCase()}.${lastNames[i].toLowerCase()}${i}@example.com`;
    
    // Distribute stages slightly, or keep all in the first stage
    // Let's put them all in "Online Assessment" to start with
    const stage = "Online Assessment";
    
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          email,
          stage,
          status: "In Review"
        })
      });
      const data = await res.json();
      if (data.success) {
        console.log(`Created candidate ${i+1}/20: ${name}`);
      } else {
        console.error(`Failed to create candidate ${name}:`, data.error);
      }
    } catch (err) {
      console.error(`Error on candidate ${name}:`, err.message);
    }
  }
  
  console.log("Seeding complete!");
}

seed();
