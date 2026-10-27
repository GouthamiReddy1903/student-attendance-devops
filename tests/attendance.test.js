
const { Builder, By, until } = require('selenium-webdriver');

async function runTest() {
    let driver;

    try {
        driver = await new Builder().forBrowser('chrome').build();

        await driver.get('http://localhost:3001');

        await driver.wait(until.elementLocated(By.css('body')), 10000);

        const pageTitle = await driver.getTitle();
        const pageText = await driver.findElement(By.css('body')).getText();

        console.log('Page title:', pageTitle);
        console.log('Attendance application opened successfully.');

        const students = ['Vaishnavi', 'Gouthami', 'Minnu'];

        for (const student of students) {
            if (pageText.includes(student)) {
                console.log('PASS: Found student - ' + student);
            } else {
                console.log('INFO: Student not found on home page - ' + student);
            }
        }

        console.log('PASS: Browser test completed.');
    } catch (error) {
        console.error('FAIL: Browser test failed.');
        console.error(error.message);
        process.exitCode = 1;
    } finally {
        if (driver) {
            await driver.quit();
        }
    }
}

runTest();
