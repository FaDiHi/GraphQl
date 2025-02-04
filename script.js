
const SIGNIN_ENDPOINT = 'https://adam-jerusalem.nd.edu/api/auth/signin';
const GRAPHQL_ENDPOINT = 'https://adam-jerusalem.nd.edu/api/graphql-engine/v1/graphql';



document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const usernameOrEmail = document.getElementById('usernameOrEmail').value;
  const password = document.getElementById('password').value;

  const authHeader = 'Basic ' + btoa(`${usernameOrEmail}:${password}`);

  try {
    const response = await fetch(SIGNIN_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      throw new Error('Invalid credentials');
    }

    const jwt = await response.text();
    console.log('Received JWT:', jwt);

    if (!jwt || !jwt.includes('.')) {
      throw new Error('Invalid JWT received.');
    }

 
    localStorage.setItem('jwt', jwt.replace(/^"|"$/g, ''));
    console.log('Stored JWT:', localStorage.getItem('jwt'));

    window.location.href = 'profile.html';
  } catch (error) {
    console.error('Login Error:', error);
    document.getElementById('error').textContent = error.message;
    document.getElementById('error').style.display = 'block';
  }
});





async function loadProfile() {
  try {
    const jwt = localStorage.getItem('jwt');
    if (!jwt || !jwt.includes('.')) {
      alert('Invalid or missing JWT. Please log in again.');
      localStorage.removeItem('jwt');
      window.location.href = 'index.html';
      return;
    }

    const payloadBase64 = jwt.split('.')[1]; 
    const decodedPayload = JSON.parse(atob(payloadBase64));
    let userId = parseInt(decodedPayload['https://hasura.io/jwt/claims']['x-hasura-user-id'], 10);
    console.log(" UserID extracted from JWT:", userId);

    const query = `
      query GetUserData($id: Int!) {
        user(where: { id: { _eq: $id } }) {
          id
          email
          login
          auditRatio
          xps {
            path
            amount
          }
        }
      }
    `;

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt.trim()}`,
      },
      body: JSON.stringify({ query, variables: { id: userId } }),
    });

    const result = await response.json();
    console.log(" GraphQL API Response:", result);


    if (!result || !result.data || !result.data.user || result.data.user.length === 0) {
      console.error("No user data found:", result);
      throw new Error('User not found in database.');
    }

    const user = result.data.user[0];


    const xps = user.xps || [];
    const totalXp = xps.reduce((sum, xp) => sum + (xp.amount || 0), 0);
    const xpInKb = (totalXp / 1000).toFixed(2);
    

  
    const profileDataDiv = document.getElementById('profileData');
    profileDataDiv.innerHTML = `
      <p><strong>ID:</strong> ${user.id || 'No ID available'}</p>
      <p><strong>Login:</strong> ${user.login || 'No ID available'}</p>
      <p><strong>Email:</strong> ${user.email || 'No Email available'}</p>
      <p><strong>Total XP:</strong> ${xpInKb} KB</p>
      <p><strong>Audit Ratio:</strong> ${user.auditRatio.toFixed(1) || 'No Audit Ratio available'}</p>
    

    `;
    drawAuditRatioChart(user.auditRatio);
    drawXpChart(xps);

  } catch (error) {
    console.error('Error loading profile:', error);
    alert(`Error: ${error.message}`);
  }
}



function drawAuditRatioChart(auditRatio) {
  const svg = d3.select("#auditChart"),
        width = 200, 
        height = 200, 
        radius = Math.min(width, height) / 2 - 10; 

  
  svg.attr("width", width).attr("height", height);
  svg.selectAll("*").remove(); 

 
  const g = svg.append("g")
               .attr("transform", `translate(${width / 2},${height / 2})`);

  
  g.append("circle")
    .attr("r", radius)
    .attr("fill", "#f1f1f1");

  
  const arc = d3.arc()
    .innerRadius(radius - 20)
    .outerRadius(radius)
    .startAngle(0)
    .endAngle((auditRatio / 2 ) * 2 * Math.PI);

 
  g.append("path")
    .attr("d", arc)
    .attr("fill", "#007BFF");

  
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .style("font-size", "20px")
    .style("font-weight", "bold")
    .style("fill", "#333")
    .text(`${auditRatio.toFixed(1)}`);
}


function drawXpChart(xps) {
  if (!xps.length) {
    console.warn(" No XP data available for the chart.");
    return;
  }

  const svg = d3.select("#xpChart"),
        width = 600, 
        height = 400, 
        margin = { top: 20, right: 30, bottom: 80, left: 70 }; 

  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  svg.attr("width", width).attr("height", height);
  svg.selectAll("*").remove(); 

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const filteredXp = xps
    .filter(xp => xp.amount > 5000) 
    .map(xp => ({
      path: xp.path.split("/").pop().replace(/[-_]/g, " "),
      amount: xp.amount
    }))
    .sort((a, b) => b.amount - a.amount) 
    .slice(0, 5); 

  

  const xScale = d3.scaleBand()
    .domain(filteredXp.map(d => d.path))
    .range([0, chartWidth])
    .padding(0.3);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(filteredXp, d => d.amount) * 1.2]) 
    .range([chartHeight, 0]);

  g.selectAll("rect")
    .data(filteredXp)
    .enter()
    .append("rect")
    .attr("x", d => xScale(d.path))
    .attr("y", d => yScale(d.amount))
    .attr("width", xScale.bandwidth())
    .attr("height", d => chartHeight - yScale(d.amount))
    .attr("fill", "steelblue");

  g.selectAll("text.xp-value")
    .data(filteredXp)
    .enter()
    .append("text")
    .attr("class", "xp-value")
    .attr("x", d => xScale(d.path) + xScale.bandwidth() / 2) 
    .attr("y", d => yScale(d.amount) - 5) 
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .style("font-weight", "bold")
    .style("fill", "#333")
    .text(d => d.amount.toLocaleString()); 

  g.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
    .attr("transform", "rotate(-20)") 
    .style("text-anchor", "end")
    .style("font-size", "14px");

  g.append("g").call(d3.axisLeft(yScale));
}



document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('jwt');
  window.location.href = 'index.html';
});



if (window.location.pathname.includes('profile.html')) {
  loadProfile();
}
