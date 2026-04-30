const fs = require('fs');

const firstNames = ['Aarav', 'Vihaan', 'Aditya', 'Rohan', 'Arjun', 'Sai', 'Kabir', 'Aryan', 'Dhruv', 'Ishaan', 'Krishna', 'Rahul', 'Karan', 'Raj', 'Vikram', 'Amit', 'Sanjay', 'Priya', 'Ananya', 'Diya', 'Kavya', 'Sanya', 'Neha', 'Pooja', 'Riya', 'Aisha', 'Kriti', 'Aditi', 'Sneha', 'Nisha', 'Meera'];
const lastNames = ['Sharma', 'Verma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Rao', 'Desai', 'Joshi', 'Chauhan', 'Thakur', 'Reddy', 'Mehta', 'Nair', 'Menon', 'Iyer', 'Pillai', 'Yadav', 'Jain', 'Bansal', 'Agarwal', 'Chatterjee', 'Bose'];
const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Ahmedabad', 'Kolkata', 'Surat', 'Jaipur'];

const stagesConfig = [
  { status: 'new', lifecycle: 'enquiry' },
  { status: 'contacted', lifecycle: 'meeting_scheduled' },
  { status: 'contacted', lifecycle: 'kit' },
  { status: 'contacted', lifecycle: 'followup_due' },
  { status: 'meeting_done', lifecycle: 'show_project' },
  { status: 'meeting_done', lifecycle: 'interested' },
  { status: 'proposal_sent', lifecycle: 'proposal_sent' },
  { status: 'converted', lifecycle: 'converted' },
  { status: 'lost', lifecycle: 'lost' }
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

function getRandomPhone() {
  return '9' + Math.floor(100000000 + Math.random() * 900000000).toString();
}

function generateLeadData() {
  const leads = [];

  for (let i = 0; i < 50; i++) {
    const fn = getRandomItem(firstNames);
    const ln = getRandomItem(lastNames);
    const spouseFn = getRandomItem(firstNames);
    const city = getRandomItem(cities);
    const projectType = Math.random() > 0.3 ? 'Residential' : 'Commercial';
    
    const stageInfo = getRandomItem(stagesConfig);
    const createdAt = getRandomDate(new Date(2023, 0, 1), new Date());

    const lead = {
      name: `${fn} ${ln}`,
      phone: getRandomPhone(),
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${Math.floor(Math.random() * 999)}@gmail.com`,
      
      spouse: Math.random() > 0.5 ? {
        name: `${spouseFn} ${ln}`,
        phone: getRandomPhone(),
      } : undefined,

      projectType: projectType,
      area: Math.floor(Math.random() * 3000) + 500, // 500 to 3500 sq ft
      budget: Math.floor(Math.random() * 5000000) + 500000, // 5L to 55L
      city: city,
      siteAddress: `Sector ${Math.floor(Math.random() * 50) + 1}, ${city}`,

      status: stageInfo.status,
      lifecycleStage: stageInfo.lifecycle,
      priority: getRandomItem(["high", "medium", "low"]),
      
      interactionHistory: [
        {
          type: "note",
          title: "Lead Created",
          description: "System generated lead for testing.",
          createdAt: { "$date": createdAt }
        }
      ],

      createdAt: { "$date": createdAt },
      updatedAt: { "$date": createdAt }
    };

    leads.push(lead);
  }

  return leads;
}

const leads = generateLeadData();
fs.writeFileSync('leads_mock_data.json', JSON.stringify(leads, null, 2));
console.log('Successfully generated 50 lead records to leads_mock_data.json');
