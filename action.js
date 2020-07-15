const core = require('@actions/core');
const github = require('@actions/github');
const { parseTestReports } = require('./utils.js');

const action = async () => {
    const reportPaths = core.getInput('report_paths');
    core.info(`Going to parse results form ${reportPaths}`);
    const githubToken = core.getInput('github_token');
    const name = core.getInput('check_name');

    let { count, skipped, annotations } = await parseTestReports(reportPaths);
    const foundResults = count > 0 || skipped > 0;
    const title = foundResults
        ? `${count} tests run, ${skipped} skipped, ${annotations.length} failed.`
        : 'No test results found!';
    core.info(`Result: ${title}`);

    const pullRequest = github.context.payload.pull_request;
    const link = pullRequest && pullRequest.html_url || github.context.ref;
    const conclusion = foundResults && annotations.length === 0 ? 'success' : 'failure';
    const status = 'completed';
    const head_sha = pullRequest && pullRequest.head.sha || github.context.sha;
    core.info(
        `Posting status '${status}' with conclusion '${conclusion}' to ${link} (sha: ${head_sha})`
    );

    const octokit = new github.GitHub(githubToken);

    const checksResponse = await octokit.checks.listForRef({...github.context.repo, ref: github.context.sha});
    const existingCheck = checksResponse.data.check_runs.filter(check => check.name === name)[0];

    core.info('-*--*--*--*--*--*--*--*--*--*-');
    core.info(JSON.stringify(existingCheck, null, 2));
    core.info('-*--*--*--*--*--*--*--*--*--*-');

    if (existingCheck) {
        const updateCheckRequest = {
            ...github.context.repo,
            check_run_id: existingCheck.id,
            output: {
                title,
                summary: '',
                annotations: annotations.slice(0, 50)
            }
        }
        await octokit.checks.update(updateCheckRequest);
    } else {
        const createCheckRequest = {
            ...github.context.repo,
            name,
            head_sha,
            status,
            conclusion,
            output: {
                title,
                summary: '',
                annotations: annotations.slice(0, 50)
            }
        };

        await octokit.checks.create(createCheckRequest);
    }
};

module.exports = action;
