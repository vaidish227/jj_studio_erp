const fs = require('fs');

const firstNames = ['Aarav', 'Vihaan', 'Aditya', 'Rohan', 'Arjun', 'Sai', 'Kabir', 'Aryan', 'Dhruv', 'Ishaan', 'Krishna', 'Rahul', 'Karan', 'Raj', 'Vikram', 'Amit', 'Sanjay', 'Priya', 'Ananya', 'Diya', 'Kavya', 'Sanya', 'Neha', 'Pooja', 'Riya', 'Aisha', 'Kriti', 'Aditi', 'Sneha', 'Nisha', 'Meera'];
const lastNames = ['Sharma', 'Verma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Rao', 'Desai', 'Joshi', 'Chauhan', 'Thakur', 'Reddy', 'Mehta', 'Nair', 'Menon', 'Iyer', 'Pillai', 'Yadav', 'Jain', 'Bansal', 'Agarwal', 'Chatterjee', 'Bose'];
const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Ahmedabad', 'Kolkata', 'Surat', 'Jaipur'];
const buildingNames = ['Sunshine Apartments', 'Green Valley Heights', 'Royal Palms', 'Silver Springs', 'Orchid Petals', 'Emerald Court', 'Crystal Towers', 'Golden View Residency'];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

function getRandomPhone() {
  return '9' + Math.floor(100000000 + Math.random() * 900000000).toString();
}

function getRandomAge() {
  return Math.floor(Math.random() * 15) + 1; // Age between 1 and 15
}

function generateClientData() {
  const clients = [];

  for (let i = 0; i < 50; i++) {
    const fn = getRandomItem(firstNames);
    const ln = getRandomItem(lastNames);
    const spouseFn = getRandomItem(firstNames);
    const city = getRandomItem(cities);
    const building = getRandomItem(buildingNames);
    const floor = Math.floor(Math.random() * 20) + 1;
    const tower = String.fromCharCode(65 + Math.floor(Math.random() * 4)); // A, B, C, D
    const unit = `${floor}0${Math.floor(Math.random() * 5) + 1}`;

    const numChildren = Math.floor(Math.random() * 3); // 0, 1, or 2
    const children = [];
    for (let j = 0; j < numChildren; j++) {
      children.push({ age: getRandomAge() });
    }

    const createdAt = getRandomDate(new Date(2023, 0, 1), new Date());

    const client = {
      name: `${fn} ${ln}`,
      phone: getRandomPhone(),
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${Math.floor(Math.random() * 999)}@gmail.com`,
      address: `${unit}, ${building}, ${city}`,
      dob: getRandomDate(new Date(1970, 0, 1), new Date(1995, 0, 1)),
      
      companyName: Math.random() > 0.5 ? `${ln} Enterprises` : undefined,
      officeAddress: Math.random() > 0.5 ? `Tech Park, Sector ${Math.floor(Math.random() * 50) + 1}, ${city}` : undefined,
      
      spouse: Math.random() > 0.3 ? {
        name: `${spouseFn} ${ln}`,
        phone: getRandomPhone(),
        email: `${spouseFn.toLowerCase()}.${ln.toLowerCase()}@gmail.com`,
        dob: getRandomDate(new Date(1975, 0, 1), new Date(1998, 0, 1)),
        anniversary: getRandomDate(new Date(2010, 0, 1), new Date(2022, 0, 1)),
      } : undefined,
      
      children: children,
      
      siteAddress: {
        buildingName: building,
        tower: tower,
        unit: unit,
        floor: floor.toString(),
        fullAddress: `${tower}-${unit}, ${building}, ${city}`,
        city: city
      },
      
      createdAt: { "$date": createdAt },
      updatedAt: { "$date": createdAt }
    };

    clients.push(client);
  }

  return clients;
}

const clients = generateClientData();
fs.writeFileSync('clients_mock_data.json', JSON.stringify(clients, null, 2));
console.log('Successfully generated 50 client records to clients_mock_data.json');
