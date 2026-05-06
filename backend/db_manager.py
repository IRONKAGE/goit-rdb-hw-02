import docker, json, os, random, sys, re

client = docker.from_env()
CONFIG_FILE = "databases.json"
NETWORK_NAME = "ironkage-sql-stand_stand_net"

def load_cfg():
    return json.load(open(CONFIG_FILE)) if os.path.exists(CONFIG_FILE) else {}

def save_cfg(d):
    json.dump(d, open(CONFIG_FILE, "w"), indent=4)

def add_db(engine, version="latest"):
    # Жорстка санітизація вводу: залишаємо тільки букви, цифри, крапки та дефіси
    engine = re.sub(r'[^\w.-]', '', str(engine)).lower()
    version = re.sub(r'[^\w.-]', '', str(version))

    db_id = f"rdb_{engine}_{random.randint(1000, 9999)}"
    cfg = load_cfg()

    if engine == "postgres":
        img, port = f"postgres:{version}-alpine", random.randint(5433, 5499)
        usr, pwd, dbn = "admin", "secret", "stand_db"
        env = [f"POSTGRES_USER={usr}", f"POSTGRES_PASSWORD={pwd}", f"POSTGRES_DB={dbn}"]
        url = f"postgresql://{usr}:{pwd}@{db_id}:5432/{dbn}"
        hc = {"test": ["CMD-SHELL", f"pg_isready -U {usr} -d {dbn}"], "interval": 10000000000, "timeout": 5000000000, "retries": 5}

    elif engine == "mysql":
        img, port = f"mysql:{version}", random.randint(3307, 3399)
        usr, pwd, dbn = "admin", "secret", "stand_db"
        env = [f"MYSQL_ROOT_PASSWORD={pwd}", f"MYSQL_DATABASE={dbn}", f"MYSQL_USER={usr}", f"MYSQL_PASSWORD={pwd}"]
        url = f"mysql+pymysql://{usr}:{pwd}@{db_id}:3306/{dbn}"
        hc = {"test": ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", usr, f"-p{pwd}"], "interval": 10000000000, "timeout": 5000000000, "retries": 5}

    elif engine == "oracle":
        img, port = f"gvenzl/oracle-free:{version}", random.randint(1522, 1599)
        usr, pwd, dbn = "admin", "secret", "freepdb1"
        env = [f"ORACLE_PASSWORD={pwd}", f"APP_USER={usr}", f"APP_PASSWORD={pwd}"]
        url = f"oracle+oracledb://{usr}:{pwd}@{db_id}:1521/?service_name={dbn}"
        hc = {"test": ["CMD", "healthcheck.sh"], "interval": 15000000000, "timeout": 10000000000, "retries": 10}

    elif engine == "mssql":
        img, port = f"mcr.microsoft.com/mssql/server:{version}", random.randint(1434, 1499)
        usr, pwd, dbn = "sa", "SuperSecret123!", "master"
        env = ["ACCEPT_EULA=Y", f"MSSQL_SA_PASSWORD={pwd}"]
        url = f"mssql+pymssql://{usr}:{pwd}@{db_id}:1433/{dbn}"
        hc = {"test": ["CMD", "/opt/mssql-tools/bin/sqlcmd", "-U", usr, "-P", pwd, "-Q", "SELECT 1"], "interval": 10000000000, "timeout": 5000000000, "retries": 5}

    else: return print("❌ Error: Invalid engine. Use postgres, mysql, oracle, or mssql.")

    print(f"🚀 Пробудження {img} (ID: {db_id})...")
    try:
        c = client.containers.run(
            img, name=db_id, environment=env,
            ports={f"{'5432' if engine=='postgres' else '3306' if engine=='mysql' else '1521' if engine=='oracle' else '1433'}/tcp": port},
            healthcheck=hc, network=NETWORK_NAME, detach=True
        )

        cfg[db_id] = {
            "engine": engine,
            "version": version,
            "port": port,
            "server": "localhost",
            "user": usr,
            "password": pwd,
            "database": dbn,
            "url": url,
            "id": c.id
        }

        save_cfg(cfg)
        print(f"✅ БД {db_id} інтегрована! Доступна на локальному порту {port}")
    except Exception as e: print(f"❌ Docker Error: {e}")

def rm_db(db_id):
    cfg = load_cfg()
    if db_id not in cfg: return print("❌ БД не знайдено")
    try:
        print(f"🗑 Видалення {db_id}...")
        client.containers.get(cfg[db_id]["id"]).remove(force=True, v=True)
        del cfg[db_id]; save_cfg(cfg)
        print("✅ Успішно видалено")
    except: del cfg[db_id]; save_cfg(cfg)

def print_usage():
    print(f"\n{YELLOW}Команда 'add' вимагає назву рушія (engine).{RESET}")
    print(f"Доступні рушії: {GREEN}postgres, mysql, oracle, mssql{RESET}")
    print("-" * 40)
    print(f"Приклади використання:")
    print(f"  make db-add engine=postgres version=18.3")
    print(f"  make db-add engine=mysql version=9.7")
    print(f"  make db-add engine=oracle version=23.26.0")
    print(f"  make db-add engine=mssql version=2025-latest")
    print("-" * 40 + "\n")

def interactive_menu():
    """Інтерактивне CLI меню для ручного управління"""
    print("\n" + "="*45)
    print(f" 🗄️  {GREEN}GOD MODE: Менеджер Баз Даних{RESET}")
    print("="*45)

    while True:
        print("\nДоступні дії:")
        print("  1. 🟢 Додати нову БД")
        print("  2. 🔴 Видалити існуючу БД")
        print("  3. 📋 Показати активні БД")
        print("  0. ❌ Вихід")

        choice = input("\n👉 Оберіть дію (0-3): ").strip()

        if choice == '1':
            print(f"\nДоступні рушії: {YELLOW}postgres, mysql, oracle, mssql{RESET}")
            engine = input("Введіть рушій [postgres]: ").strip().lower() or "postgres"
            version = input("Введіть версію [latest]: ").strip() or "latest"
            print("-" * 30)
            add_db(engine, version)

        elif choice == '2':
            cfg = load_cfg()
            if not cfg:
                print(f"⚠️ {YELLOW}Немає активних баз для видалення.{RESET}")
                continue

            print("\n--- Активні бази ---")
            for db_id, data in cfg.items():
                eng = data.get('engine', 'unknown')
                ver = data.get('version', 'latest')
                print(f" - {GREEN}{db_id}{RESET} [{eng}:{ver}] (порт: {data['port']})")

            db_id = input("\nВведіть ID бази для видалення або Enter для відміни: ").strip()
            if db_id:
                print("-" * 30)
                rm_db(db_id)

        elif choice == '3':
            print("\n--- Активні бази ---")
            cfg = load_cfg()
            if not cfg:
                print(f"⚠️ {YELLOW}БД не знайдено.{RESET}")
            else:
                print(json.dumps(cfg, indent=2, ensure_ascii=False))

        elif choice == '0':
            print("👋 Вихід з менеджера. Хай щастить, Tech Lead!")
            break
        else:
            print(f"⚠️ {YELLOW}Невідома команда. Спробуйте ще раз.{RESET}")

if __name__ == "__main__":
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RESET = '\033[0m'

    if len(sys.argv) < 2:
        try:
            interactive_menu()
        except KeyboardInterrupt:
            print("\n👋 Примусовий вихід. До зустрічі!")
        sys.exit(0)

    action = sys.argv[1]

    if action == "add":
        if len(sys.argv) < 3:
            print_usage()
            sys.exit(1)
        engine = sys.argv[2]
        version = sys.argv[3] if len(sys.argv) > 3 else "latest"
        add_db(engine, version)

    elif action == "rm":
        if len(sys.argv) < 3:
            print(f"❌ Помилка: Вкажіть ID бази для видалення")
            sys.exit(1)
        rm_db(sys.argv[2])

    elif action == "list":
        print(json.dumps(load_cfg(), indent=2, ensure_ascii=False))

    else:
        print(f"❌ Невідома команда: {action}")
