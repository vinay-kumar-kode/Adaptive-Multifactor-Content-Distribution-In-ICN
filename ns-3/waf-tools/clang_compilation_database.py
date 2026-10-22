
"""
A Waf tool to generate a Clang compilation database.
"""

import sys
import os
import json
import shlex

from waflib import Logs, TaskGen, Task
from waflib.Tools import c, cxx

Task.TaskBase.keep_last_cmd = True

# Python 3.3+ supports shlex.quote.
quote = shlex.quote


@TaskGen.feature('*')
@TaskGen.after_method('process_use')
def collect_compilation_db_tasks(self):
    """Add a compilation database entry for compiled tasks."""
    try:
        clang_db = self.bld.clang_compilation_database_tasks
    except AttributeError:
        clang_db = self.bld.clang_compilation_database_tasks = []
        self.bld.add_post_fun(write_compilation_database)

    for task in getattr(self, 'compiled_tasks', []):
        if isinstance(task, (c.c, cxx.cxx)):
            clang_db.append(task)


def write_compilation_database(ctx):
    """Write compile_commands.json."""
    db = []

    for task in getattr(ctx, 'clang_compilation_database_tasks', []):
        try:
            cmd = task.env.CXX
            cmd = [str(x) for x in cmd]
            cmd.extend(task.env.CXXFLAGS)
            cmd.extend(task.env.INCLUDES)
            cmd.extend(task.env.DEFINES)
            cmd.extend(task.env.ARCH_ST)
            cmd.extend(task.env.ARCH)

            source = task.inputs[0].abspath()
            output = task.outputs[0].abspath()

            entry = {
                'directory': task.get_cwd().abspath(),
                'command': ' '.join(map(quote, cmd)),
                'file': source,
                'output': output
            }
            db.append(entry)
        except (AttributeError, IndexError, TypeError) as error:
            Logs.warn('Could not add a compilation database entry: %s', error)

    filename = os.path.join(ctx.bldnode.abspath(), 'compile_commands.json')
    with open(filename, 'w', encoding='utf-8') as output_file:
        json.dump(db, output_file, indent=2)

