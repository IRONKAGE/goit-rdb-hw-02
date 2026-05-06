-- =======================================================
-- Завдання 2: Нормалізація до 3НФ
-- =======================================================

-- 1. Створення таблиці Клієнтів (Customers)
CREATE TABLE customers (
    customer_id INT PRIMARY KEY AUTO_INCREMENT, -- Для Postgres змініть на SERIAL
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255)
);

-- 2. Створення таблиці Товарів (Products)
CREATE TABLE products (
    product_id INT PRIMARY KEY AUTO_INCREMENT, -- Для Postgres змініть на SERIAL
    product_name VARCHAR(150) NOT NULL UNIQUE
);

-- 3. Створення таблиці Замовлень (Orders)
CREATE TABLE orders (
    order_id INT PRIMARY KEY AUTO_INCREMENT, -- Для Postgres змініть на SERIAL
    order_date DATE NOT NULL,
    customer_id INT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- 4. Створення зв'язуючої таблиці Деталі Замовлення (Order_Details)
CREATE TABLE order_details (
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (order_id, product_id), -- Складений первинний ключ
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- =======================================================
-- Тестове наповнення даними (DML)
-- =======================================================

INSERT INTO customers (name, address) VALUES
('Іван Іванов', 'Київ, вул. Хрещатик 1'),
('Петро Петров', 'Львів, вул. Франка 5');

INSERT INTO products (product_name) VALUES
('Ноутбук Dell XPS 15'),
('Миша Logitech MX Master 3'),
('Монітор LG UltraGear');

INSERT INTO orders (order_date, customer_id) VALUES
('2023-10-01', 1),
('2023-10-02', 2);

INSERT INTO order_details (order_id, product_id, quantity) VALUES
(1, 1, 1),
(1, 2, 2),
(2, 3, 1),
(2, 2, 1);
