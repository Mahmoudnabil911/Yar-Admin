"""Private local setup: passwords entered without echo or shell history."""
import getpass
import os
from pathlib import Path
import subprocess
import sys

def main():
    if not sys.stdin.isatty():
        raise SystemExit('Run this setup in an interactive private terminal.')
    print('YAR — private initial setup. No account will be installed automatically.')
    print('Requires Node.js. Do not send passwords or generated files in chat.')
    env = os.environ.copy()
    for prefix, label in [('YAR_INITIAL', 'Administrator'), ('YAR_EMPLOYEE', 'Reception & Booking Employee')]:
        env[prefix + '_NAME'] = input(label + ' full name: ').strip()
        env[prefix + '_PHONE'] = input(label + ' Iraqi mobile number (not the public support number): ').strip()
        password = getpass.getpass(label + ' initial password (10+ characters, letter and number): ')
        if password != getpass.getpass('Confirm initial password: '):
            raise SystemExit('Passwords do not match. Nothing created.')
        env[prefix + '_PASSWORD'] = password
    existing = input('Private existing account export path, or Enter for a fresh browser: ').strip()
    if existing:
        env['YAR_EXISTING_ACCOUNTS_FILE'] = str(Path(existing).expanduser().resolve())
        env['YAR_ADMIN_EXISTING_ID'] = input('Existing administrator ID, or Enter to match confirmed phone: ').strip()
        env['YAR_EMPLOYEE_EXISTING_ID'] = input('Existing employee ID, or Enter to match confirmed phone: ').strip()
        if input('Type UPDATE to confirm resetting these two accounts only: ') != 'UPDATE':
            raise SystemExit('Cancelled. Nothing created.')
        env['YAR_CONFIRM_EXISTING_UPDATE'] = 'owner-approved'
    output = Path(input('New private output file path outside the project: ').strip()).expanduser().resolve()
    project = Path(__file__).resolve().parent.parent
    if output == project or project in output.parents:
        raise SystemExit('Output must be outside the project and all public folders.')
    result = subprocess.run(['node', str(project / 'scripts/provision-yar.mjs'), str(output)], env=env, check=False)
    if result.returncode:
        raise SystemExit(result.returncode)
    print('Private account file prepared. Install it only into the intended YAR browser origin.')
    print('Use the two phone numbers you entered, not the public support phone.')
    print('Both owner logins still require verification after installation.')

if __name__ == '__main__':
    main()