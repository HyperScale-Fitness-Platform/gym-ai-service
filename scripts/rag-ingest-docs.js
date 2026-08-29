const dotenv = require("dotenv");
dotenv.config();

const pool = require("../src/config/database");
const { generateEmbedding } = require("../src/services/embedding.service");

// A simple array of documents for now — could later come from a folder
const documents = [
  {
    title: "Leg Press Machine",
    content: "The leg press machine targets quadriceps, hamstrings, and glutes. To use: sit in the seat, place feet shoulder-width on the platform, release the safety handles, lower the platform by bending knees to 90 degrees, then push back to start. Keep your lower back pressed against the seat throughout and avoid locking out your knees at the top.",
  },
  {
    title: "Lat Pulldown Machine",
    content: "The lat pulldown targets the back (latissimus dorsi) and biceps. Sit facing the machine, secure thighs under the roller pads, grip the wide bar outside shoulder width, pull the bar down smoothly to your upper chest while driving elbows down, then slowly return up. Avoid leaning back excessively or swinging.",
  },
  {
    title: "Chest Press Machine",
    content: "The seated chest press isolates the pectoral muscles, anterior deltoids, and triceps. Adjust the seat height so the handles align with the middle of your chest. Plant feet flat, press handles forward until arms are almost fully extended without locking elbows, pause briefly, then return slowly to the chest level.",
  },
  {
    title: "Seated Cable Row",
    content: "The seated cable row targets the middle back, rhomboids, lats, and biceps. Sit with knees slightly bent and feet against the footrests. Grasp the V-bar handle, keep your back tall with a neutral spine, pull the handle to your abdomen while squeezing shoulder blades together, then control the weight back without rounding your back.",
  },
  {
    title: "Leg Extension Machine",
    content: "The leg extension is an isolation exercise for the quadriceps (front thigh muscles). Adjust the backrest so your knee joints align with the machine's pivot axis. Place the shin pad just above the ankles. Extend legs upward until straight, hold for 1 second to squeeze the quads, then lower under control. Avoid explosive kicking.",
  },
  {
    title: "Seated / Lying Leg Curl Machine",
    content: "The leg curl machine isolates the hamstrings (back of thighs). Adjust the lever arm so the roller rests just below the calves against the Achilles tendon. Curl the legs downward or toward your glutes by bending at the knees, hold the contraction at the peak, then slowly extend back to starting position without letting the weights slam.",
  },
  {
    title: "Pec Deck / Fly Machine",
    content: "The pec deck machine targets the inner and outer chest (pectoralis major). Adjust seat height so elbow pads or handles are level with your chest. Place forearms on pads or grasp handles, bring your arms together in front of your chest while contracting your pecs, then slowly open arms back until you feel a gentle chest stretch.",
  },
  {
    title: "Shoulder Overhead Press Machine",
    content: "The overhead shoulder press targets the deltoids and triceps. Adjust seat height so handles sit at shoulder height. Grasp handles with palms facing forward or neutral, press upward overhead until arms are extended, then slowly lower the handles back down to ear level. Keep core braced and lower back against the pad.",
  },
  {
    title: "Cable Crossover / Dual Adjustable Pulley",
    content: "The dual adjustable pulley supports multi-angle chest flyes, tricep pushdowns, bicep curls, and face pulls. Adjust pulley sliders to desired height by pulling the pin. Attach your chosen handle (rope, straight bar, D-handles). Maintain a stable split stance and braced core to prevent momentum while executing repetitions.",
  },
  {
    title: "Smith Machine",
    content: "The Smith machine features a barbell fixed on vertical guide rails with safety catches. Suitable for squats, bench press, lunges, and Romanian deadlifts. Always set the adjustable safety stop pins at the bottom of your range of motion before loading plates. Rotate wrists to unhook the bar and rotate back to lock it onto hooks when finished.",
  },
  {
    title: "Assisted Pull-Up and Dip Machine",
    content: "This machine counterbalances your bodyweight to assist pull-ups and tricep dips. Select counterweight on the stack (higher weight equals more assistance). Step or kneel onto the pad, grip the pull-up handles for back/biceps or parallel dip bars for chest/triceps, perform the movement with controlled cadence, and step off carefully.",
  },
  {
    title: "StairMaster / Stepmill",
    content: "The StairMaster is a revolving staircase cardio machine focusing on glutes, quads, calves, and aerobic endurance. Step onto the pedals, press Quick Start, and set speed. Maintain an upright posture with a light fingertip grip on handrails for balance. Avoid leaning body weight onto the console or slouching shoulders.",
  },
  {
    title: "Treadmill",
    content: "Treadmills support walking, jogging, and incline running for cardiovascular conditioning. Clip the red emergency stop cord to your shirt before starting. Press Quick Start, adjust speed and incline buttons gradually. Step off using the side foot rails in case of emergency or when finishing the cooldown.",
  },
  {
    title: "Rowing Machine (Ergometer)",
    content: "The indoor rower is a full-body cardio machine working legs, back, core, and arms. Strap feet securely into footplates. Order of movement: Drive back with legs (60%), hinge torso back slightly (20%), and pull handle to lower ribs with arms (20%). Reverse the sequence smoothly on the return: arms extend, torso hinges forward, knees bend.",
  },
  {
    title: "Abdominal Crunch Machine",
    content: "The seated ab crunch machine isolates the rectus abdominis. Select a moderate weight, sit with upper back against the pad, grip handles or rest elbows on pads, and hook feet under ankle rollers if available. Flex your core to curl your torso forward, squeeze your abs, then slowly return without letting the weight stack rest.",
  },
  {
    title: "Hyperextension / Roman Chair",
    content: "The 45-degree hyperextension bench develops the lower back (erector spinae), glutes, and hamstrings. Position thigh pads just below your hip crease to allow free bending. Cross arms over chest, hinge forward at the hips, then raise torso up until body forms a straight line. Do not overextend or arch backward past neutral.",
  }
];

async function ingest() {
  for (const doc of documents) {
    const embedding = await generateEmbedding(doc.content);
    await pool.query(
      `INSERT INTO equipment_docs (title, content, embedding) VALUES ($1, $2, $3)`,
      [doc.title, doc.content, JSON.stringify(embedding)]
    );
    console.log(`Ingested: ${doc.title}`);
  }
  process.exit(0);
}

ingest();