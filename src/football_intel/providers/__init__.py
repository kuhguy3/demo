"""Pluggable live-data providers for football_intel.

Each provider is optional and activated by an environment variable holding
an API key. With no keys set, football_intel falls back to the bundled
sample fixtures (see football_intel.data.sample_fixtures) so the module
always runs standalone.
"""
