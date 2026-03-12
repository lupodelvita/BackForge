from src.static_analyzer import StaticAnalyzer, infer_table_name


def test_extract_fetch_calls_simple():
    code = """
    const response = await fetch('/api/users');
    const data = await fetch('/api/products/123');
    """
    analyzer = StaticAnalyzer()
    findings = analyzer.extract_api_calls(code, "javascript")
    paths = [f.path for f in findings]
    assert "/api/users" in paths
    assert "/api/products/123" in paths


def test_extract_axios_calls():
    code = """
    const users = await axios.get('/api/users');
    await axios.post('/api/users', { name: 'John' });
    await axios.delete('/api/users/5');
    """
    analyzer = StaticAnalyzer()
    findings = analyzer.extract_api_calls(code, "javascript")
    methods = {(f.path, f.method) for f in findings}
    assert ("/api/users", "GET") in methods
    assert ("/api/users", "POST") in methods
    assert ("/api/users/5", "DELETE") in methods


def test_infer_table_name_from_path():
    assert infer_table_name("/api/users") == "users"
    assert infer_table_name("/api/v1/products") == "products"
    assert infer_table_name("/api/user-profiles") == "user_profiles"


def test_extract_typescript_interface():
    code = """
    interface User {
        id: string;
        email: string;
        name: string;
        createdAt: Date;
        isActive: boolean;
    }
    """
    analyzer = StaticAnalyzer()
    interfaces = analyzer.extract_interfaces(code, "typescript")
    assert len(interfaces) == 1
    assert interfaces[0].name == "User"
    field_names = [f.name for f in interfaces[0].fields]
    assert "id" in field_names
    assert "email" in field_names


def test_empty_code_returns_empty_findings():
    analyzer = StaticAnalyzer()
    findings = analyzer.extract_api_calls("", "javascript")
    assert findings == []
