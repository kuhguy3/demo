import socket
import threading

from playground.recon import port_scanner


def _start_test_server():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(("127.0.0.1", 0))
    server.listen(1)
    port = server.getsockname()[1]

    def accept_loop():
        try:
            while True:
                conn, _ = server.accept()
                conn.close()
        except OSError:
            pass

    thread = threading.Thread(target=accept_loop, daemon=True)
    thread.start()
    return server, port


def test_scan_detects_open_port():
    server, port = _start_test_server()
    try:
        results = port_scanner.scan("127.0.0.1", ports=[port], timeout=1.0)
        assert len(results) == 1
        assert results[0].port == port
        assert results[0].open is True
    finally:
        server.close()


def test_scan_detects_closed_port():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    closed_port = sock.getsockname()[1]
    sock.close()

    results = port_scanner.scan("127.0.0.1", ports=[closed_port], timeout=1.0)
    assert len(results) == 1
    assert results[0].open is False


def test_format_results_reports_no_open_ports():
    text = port_scanner.format_results("127.0.0.1", [port_scanner.PortResult(port=9999, open=False)])
    assert "no open ports found" in text
