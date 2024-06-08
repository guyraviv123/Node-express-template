import { join } from 'path';
import { readFileSync } from 'fs';
import express from 'express';
import serveStatic from 'serve-static';
import  mysql  from "mysql2" ;

import shopify from './shopify.js';
import webhooks from './webhooks.js';

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT, 10);




const STATIC_PATH =
	process.env.NODE_ENV === 'production'
		? `${process.cwd()}/frontend/dist`
		: `${process.cwd()}/frontend/`;

const app = express();

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
	shopify.config.auth.callbackPath,
	shopify.auth.callback(),
	shopify.redirectToShopifyOrAppRoot()
);
app.post(
	shopify.config.webhooks.path,
	// @ts-ignore
	shopify.processWebhooks({ webhookHandlers: webhooks })
);



// All endpoints after this point will require an active session
app.use('/api/*', shopify.validateAuthenticatedSession());

app.use(express.json());

app.use(serveStatic(STATIC_PATH, { index: false }));




  // Parse the DATABASE_URL
const dbUrl = new URL(process.env.DATABASE_URL);

// Create a MySQL connection
const connection = mysql.createConnection({
  host: dbUrl.hostname,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.substring(1), // remove leading slash
  port: dbUrl.port
});

// Connect to the MySQL database
connection.connect(err => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
    return;
  }
  console.log('Connected to the database.');
});

// Create the table if it doesn't exist
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS customers (
    customer_id BIGINT PRIMARY KEY,
    products JSON
  )
`;

connection.query(createTableQuery, (err, results) => {
  if (err) {
    console.error('Error creating table:', err);
    return;
  }
  console.log('Table created or already exists.');
});


app.get("/proxy/import-saved-cart", (req, res) => {
    const customerId = req.query.customerId;
  
    // Query to select products by customer ID
    const query = 'SELECT products FROM customers WHERE customer_id = ?';
  
    // Execute the query
    connection.query(query, [customerId], (err, results) => {
      if (err) {
        console.error('Error retrieving products:', err);
        res.status(500).send('Error retrieving products');
        return;
      }
  
      if (results.length === 0) {
        res.status(404).send('Customer not found');
        return;
      }
  
      console.log('Table results ===',results);
      const products = results[0].products;
      let objResult;
      try {
        objResult = transformArrayToObject(products);
      } catch (error) {
        console.error('Error transforming products:', error);
        res.status(400).send('Invalid products data');
        return;
      }
  
      console.log("products obj", objResult);
      res.status(200).json(objResult);
    });
  }); 




// Endpoint to save cart
app.post("/proxy/save-cart", (req, res) => {
    const { CustomerId, productId } = req.body;
  
    // Insert data into the database
    const query = 'INSERT INTO customers (customer_id, products) VALUES (?, ?)';
      // Insert or update query
  const insertOrUpdateQuery = `
  INSERT INTO customers (customer_id, products)
  VALUES (?, ?)
  ON DUPLICATE KEY UPDATE products = VALUES(products);
`;
    connection.query(insertOrUpdateQuery, [CustomerId, JSON.stringify(productId)], (err, results) => {
      if (err) {
        console.error('Error saving data:', err);
        res.status(500).send('Error saving data');
        return;
      }
      res.status(200).send({ success: 200 });
    });
  });



app.use('/*', shopify.ensureInstalledOnShop(), async (_req, res) => {
   
	return res.set('Content-Type', 'text/html').send(readFileSync(join(STATIC_PATH, 'index.html')));
});


  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
  });


  function transformArrayToObject(inputArray) {
    if (!Array.isArray(inputArray)) {
      throw new TypeError('Expected input to be an array');
    }
  
    let formData = { 'items': [] };
  
    inputArray.forEach(item => {
      formData.items.push({ 'id': item });
    });
  
    return formData;
  }


app.listen(PORT);
