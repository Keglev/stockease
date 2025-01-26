# API Documentation

This document provides detailed information about the API endpoints available in the StockEase backend application.

---

## **Authentication Endpoints**

### **POST** `/api/auth/login`
Authenticate a user and generate a JWT token.

#### Request Body:
```json
{
  "username": "user1",
  "password": "password123"
}
```

#### Response:
- **200 OK:**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": "eyJhbGciOiJIUzI1..."
  }
  ```
- **400 Bad Request:**
  ```json
  {
    "success": false,
    "message": "Username and password cannot be blank",
    "data": null
  }
  ```
- **401 Unauthorized:**
  ```json
  {
    "success": false,
    "message": "Invalid username or password",
    "data": null
  }
  ```
- **500 Internal Server Error:**
  ```json
  {
    "success": false,
    "message": "An unexpected error occurred",
    "data": null
  }
  ```

---

## **Product Endpoints**

### **GET** `/api/products`
Fetch all products.

#### Response:
- **200 OK:**
  ```json
  [
    {
      "id": 1,
      "name": "Product A",
      "quantity": 10,
      "price": 20.5
    },
    {
      "id": 2,
      "name": "Product B",
      "quantity": 5,
      "price": 15.0
    }
  ]
  ```

---

### **GET** `/api/products/paged`
Fetch paginated products.

#### Query Parameters:
- `page` (default: `0`): Page number (0-based).
- `size` (default: `10`): Number of items per page.

#### Response:
- **200 OK:**
  ```json
  {
    "success": true,
    "message": "Paged products fetched successfully",
    "data": {
      "content": [
        {
          "id": 1,
          "name": "Product A",
          "quantity": 10,
          "price": 20.5
        }
      ],
      "pageNumber": 0,
      "pageSize": 10,
      "totalElements": 2,
      "totalPages": 1
    }
  }
  ```

---

### **GET** `/api/products/{id}`
Fetch product details by ID.

#### Path Parameter:
- `id`: Product ID.

#### Response:
- **200 OK:**
  ```json
  {
    "success": true,
    "message": "Product fetched successfully",
    "data": {
      "id": 1,
      "name": "Product A",
      "quantity": 10,
      "price": 20.5
    }
  }
  ```
- **404 Not Found:**
  ```json
  {
    "success": false,
    "message": "The product with ID 1 does not exist.",
    "data": null
  }
  ```

---

### **POST** `/api/products`
Create a new product.

#### Request Body:
```json
{
  "name": "Product A",
  "quantity": 10,
  "price": 20.5
}
```

#### Response:
- **200 OK:**
  ```json
  {
    "id": 1,
    "name": "Product A",
    "quantity": 10,
    "price": 20.5
  }
  ```
- **400 Bad Request:**
  ```json
  {
    "error": "Incomplete update. Please fill in all required fields."
  }
  ```

---

### **DELETE** `/api/products/{id}`
Delete a product by ID.

#### Path Parameter:
- `id`: Product ID.

#### Response:
- **200 OK:**
  ```json
  {
    "success": true,
    "message": "Product with ID 1 has been successfully deleted.",
    "data": null
  }
  ```
- **404 Not Found:**
  ```json
  {
    "success": false,
    "message": "Cannot delete. Product with ID 1 does not exist.",
    "data": null
  }
  ```

---

### **PUT** `/api/products/{id}/quantity`
Update the quantity of a product.

#### Request Body:
```json
{
  "quantity": 15
}
```

#### Response:
- **200 OK:**
  ```json
  {
    "success": true,
    "message": "Quantity updated successfully",
    "data": {
      "id": 1,
      "name": "Product A",
      "quantity": 15,
      "price": 20.5
    }
  }
  ```
- **400 Bad Request:**
  ```json
  {
    "success": false,
    "message": "Quantity cannot be negative.",
    "data": null
  }
  ```

---

### **PUT** `/api/products/{id}/price`
Update the price of a product.

#### Request Body:
```json
{
  "price": 25.0
}
```

#### Response:
- **200 OK:**
  ```json
  {
    "success": true,
    "message": "Price updated successfully",
    "data": {
      "id": 1,
      "name": "Product A",
      "quantity": 10,
      "price": 25.0
    }
  }
  ```
- **400 Bad Request:**
  ```json
  {
    "success": false,
    "message": "Price must be greater than 0.",
    "data": null
  }
  ```

---

### **GET** `/api/products/low-stock`
Fetch products with stock less than 5.

#### Response:
- **200 OK:**
  ```json
  [
    {
      "id": 2,
      "name": "Product B",
      "quantity": 4,
      "price": 15.0
    }
  ]
  ```

---

### **GET** `/api/products/search`
Search products by name.

#### Query Parameter:
- `name`: Name (or part of name) to search.

#### Response:
- **200 OK:**
  ```json
  [
    {
      "id": 1,
      "name": "Product A",
      "quantity": 10,
      "price": 20.5
    }
  ]
  ```
- **204 No Content:**
  ```json
  {
    "message": "No products found matching the name: Product C"
  }
  ```

