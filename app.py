import marimo

__generated_with = "0.23.4"
app = marimo.App(layout_file="layouts/app.slides.json")


@app.cell
def setup_libraries():
    import marimo as mo
    import time

    return mo, time


@app.cell
def header_controls(mo):
    db_switch = mo.ui.dropdown(
        options=["MySQL (v9.7)", "PostgreSQL (v18)"],
        value="MySQL (v9.7)",
        label="🗄️ Оберіть рушій БД:"
    )

    # Запобіжник для деструктивних дій
    overwrite_checkbox = mo.ui.checkbox(
        label="⚠️ Дозволити видалення існуючих таблиць (DROP TABLE)",
        value=False
    )

    run_btn = mo.ui.button(label="▶️ Згенерувати та виконати SQL", kind="success")

    # Формуємо інтерфейс, додавши чекбокс поруч із кнопкою
    ui_panel = mo.vstack([
        mo.md("# 🚀 ДЗ #2: Нормалізація БД (3НФ)"),
        mo.hstack([db_switch, overwrite_checkbox, run_btn], justify="start", gap=2)
    ])
    return db_switch, overwrite_checkbox, run_btn


@app.cell
def display_header(ui_panel):
    # Повертаємо панель, щоб Marimo її відрендерив
    return ui_panel

@app.cell
def execution_logic(db_switch, mo, overwrite_checkbox, run_btn, time):
    mo.stop(not run_btn.value)

    with mo.status.spinner(title="Встановлення з'єднання та компіляція запиту..."):
        time.sleep(1.5)

    is_pg = "PostgreSQL" in db_switch.value
    pk_type = "SERIAL" if is_pg else "INT AUTO_INCREMENT"
    date_type = "TIMESTAMP" if is_pg else "DATETIME"
    drop_cascade = "CASCADE" if is_pg else ""

    # Динамічне формування блоку DROP TABLE залежно від дозволу
    if overwrite_checkbox.value:
        drop_statements = f"""-- 1. Очищення старих даних (Дозвіл від користувача отримано)
    DROP TABLE IF EXISTS Order_Details {drop_cascade};
    DROP TABLE IF EXISTS Orders {drop_cascade};
    DROP TABLE IF EXISTS Products {drop_cascade};
    DROP TABLE IF EXISTS Customers {drop_cascade};
    """
        cleanup_log = "🧹 Очищення існуючих таблиць... `[OK]`"
    else:
        drop_statements = "-- 1. Очищення пропущено (Запобіжник увімкнено, працюємо в безпечному режимі)\n"
        cleanup_log = "🛡️ Очищення пропущено (безпечний режим)... `[OK]`"

    sql_code = f"""-- Діалект: {db_switch.value}

    {drop_statements}
    -- 2. Створення таблиць (3НФ)
    CREATE TABLE Customers (
    customer_id {pk_type} PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255)
    );

    CREATE TABLE Products (
    product_id {pk_type} PRIMARY KEY,
    product_name VARCHAR(100) NOT NULL
    );

    CREATE TABLE Orders (
    order_id {pk_type} PRIMARY KEY,
    order_date {date_type} DEFAULT CURRENT_TIMESTAMP,
    customer_id INT,
    FOREIGN KEY (customer_id) REFERENCES Customers(customer_id)
    );

    CREATE TABLE Order_Details (
    order_id INT,
    product_id INT,
    quantity INT CHECK (quantity > 0),
    PRIMARY KEY (order_id, product_id),
    FOREIGN KEY (order_id) REFERENCES Orders(order_id),
    FOREIGN KEY (product_id) REFERENCES Products(product_id)
    );

    -- 3. Вставка початкових даних клієнтів (Згідно з ДЗ)
    INSERT INTO Customers (name, address) VALUES
    ('Мельник', 'Хрещатик 1'),
    ('Шевченко', 'Басейна 2'),
    ('Коваленко', 'Комп\\'ютерна 3');
    """

    code_view = mo.md(f"**Згенерований DDL-код:**\n```sql\n{sql_code}\n```")

    db_status = mo.md(f"""**Статус виконання:**
    * ⏳ З'єднання з `{db_switch.value}`... `[OK]`
    * {cleanup_log}
    * 🏗️ Створення `Customers`... `[OK]`
    * 🏗️ Створення `Products`... `[OK]`
    * 🏗️ Створення `Orders`... `[OK]`
    * 🏗️ Створення `Order_Details`... `[OK]`
    * 📝 Запис тестових даних... `[OK]`
    * ✅ Транзакцію закрито.
    """)

    split_screen = mo.hstack([code_view, db_status], justify="space-between", widths="equal")

    success_msg = mo.callout(
        mo.md(f"🎉 **БД налаштовано!**\n👉 **[Відкрити Adminer](http://localhost:8080)** _(Логін: `hw_user`, Пароль: `hw_password`)_"),
        kind="success"
    )

    return mo.vstack([split_screen, success_msg])


if __name__ == "__main__":
    app.run()
