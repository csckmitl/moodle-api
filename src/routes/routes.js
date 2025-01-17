import { Router } from 'express'
import axios from 'axios'
import { check, validationResult } from 'express-validator'
import moment from 'moment'

const routes = Router()

const { MOODLE_BASE_URL } = process.env
const MOODLE_TOKEN = '1398f75a226fa8cf9ed47902b8fd1a5e'
const MOODLE_FORMAT = 'json'
const API_BASE_URL = 'http://192.168.251.129/moodle'

const errorHandle = (status, data) => {
    const err = new Error()
    err.status = status
    err.errors = []
    err.errorDetails = []
    for (const errData in data) {
        err.errors.push(data[errData].param)
        err.errorDetails.push(data[errData].msg)
    }
    return err
}

const response = (successes, errors, errorDetails) => {
    return {
        successes: successes,
        errors: errors,
        errorDetails: errorDetails
    }
}

routes.post(
    '/courses',
    [
        check('fullName', 'fullName invalid').exists(),
        check('shortName', 'shortName invalid').exists(),
        check('catagoryId', 'catagoryId invalid').exists(),
        check('startDate', 'startDate invalid use format YYYY-MM-DD HH:mm:ss').exists().isISO8601(),
        check('stopDate', 'stopDate invalid use format YYYY-MM-DD HH:mm:ss').exists().isISO8601(),
        check('lang', 'lang invalid use \'th\' or  \'en\'').exists(),
    ],
    async (req, res, next) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return next(errorHandle(400, errors.mapped()))
        }

        const startDate = moment(req.body.startDate, 'YYYY-MM-DD HH:mm:ss').unix()
        const stopDate = moment(req.body.stopDate, 'YYYY-MM-DD HH:mm:ss').unix()

        const paramsCreateCourse = new URLSearchParams()
        paramsCreateCourse.append('wstoken', MOODLE_TOKEN)
        paramsCreateCourse.append('wsfunction', 'core_course_create_courses')
        paramsCreateCourse.append('moodlewsrestformat', MOODLE_FORMAT)

        paramsCreateCourse.append('courses[0][fullname]', req.body.fullName) // string
        paramsCreateCourse.append('courses[0][shortname]', req.body.shortName) // string
        paramsCreateCourse.append('courses[0][categoryid]', 1) // int
        paramsCreateCourse.append('courses[0][idnumber]', '') // string
        paramsCreateCourse.append('courses[0][summary]', '') // string
        paramsCreateCourse.append('courses[0][summaryformat]', 1) // int
        paramsCreateCourse.append('courses[0][format]', 'topics') // string
        paramsCreateCourse.append('courses[0][showgrades]', 1) // int
        paramsCreateCourse.append('courses[0][newsitems]', 5) // int
        paramsCreateCourse.append('courses[0][startdate]', startDate) // int
        paramsCreateCourse.append('courses[0][enddate]', stopDate) // int
        paramsCreateCourse.append('courses[0][numsections]', 4) // int
        paramsCreateCourse.append('courses[0][maxbytes]', 0) // int
        paramsCreateCourse.append('courses[0][showreports]', 0) // int
        paramsCreateCourse.append('courses[0][visible]', 1) // int
        paramsCreateCourse.append('courses[0][hiddensections]', 0) // int
        paramsCreateCourse.append('courses[0][groupmode]', 0) // int
        paramsCreateCourse.append('courses[0][groupmodeforce]', 0) // int
        paramsCreateCourse.append('courses[0][defaultgroupingid]', 0) // int
        paramsCreateCourse.append('courses[0][enablecompletion]', 1) // int
        paramsCreateCourse.append('courses[0][completionnotify]', 0) // int
        paramsCreateCourse.append('courses[0][lang]', req.body.lang) // string
        const data = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, paramsCreateCourse)
        if (data.data.exception) {
            res.json(response([], [req.body.shortName], [data.data]))
        }
    },
)

routes.post('/course/:courseShortName/enrol/students', [
    check('user', 'user invalid, user field must be a array').exists().isArray()
],async (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return next(errorHandle(400, errors.mapped()))
    }

    const paramsCourseDetail = new URLSearchParams()
    paramsCourseDetail.append('wstoken', MOODLE_TOKEN)
    paramsCourseDetail.append('wsfunction', 'core_course_get_courses_by_field')
    paramsCourseDetail.append('moodlewsrestformat', MOODLE_FORMAT)
    paramsCourseDetail.append('field', 'shortname')
    paramsCourseDetail.append('value', req.params.courseShortName)

    const courseDetail = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, paramsCourseDetail)

    if (!courseDetail.data.courses[0]) {
        res.statusCode = 404
        return res.json(response(null, [req.params.courseShortName], ["Course not found"]))
    }

    const courseId = courseDetail.data.courses[0].id

    const detail = await Promise.all(req.body.user.map(async email => {
        const enrolRes = await enrolUser(5, email, courseId)
        return { email: email, detail: enrolRes }
    }))

    let dataRes = {
        successes: [],
        errors: [],
        errorDetails: []
    }

    for(let i = 0; i < detail.length; i++) {
        if (detail[i].detail.successes) {
            dataRes.successes.push(detail[i].email)
        } else {
            dataRes.errors.push(detail[i].email)
            dataRes.errorDetails.push("User not found")
        }
    }

    res.json(response(dataRes.successes, dataRes.errors, dataRes.errorDetails))
})

routes.post('/course/:courseShortName/enrol/teachers', [
    check('user', 'user invalid, user field must be a array').exists().isArray()
], async (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return next(errorHandle(400, errors.mapped()))
    }

    const paramsCourseDetail = new URLSearchParams()
    paramsCourseDetail.append('wstoken', MOODLE_TOKEN)
    paramsCourseDetail.append('wsfunction', 'core_course_get_courses_by_field')
    paramsCourseDetail.append('moodlewsrestformat', MOODLE_FORMAT)
    paramsCourseDetail.append('field', 'shortname')
    paramsCourseDetail.append('value', req.params.courseShortName)

    const courseDetail = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, paramsCourseDetail)

    if (!courseDetail.data.courses[0]) {
        res.statusCode = 404
        return res.json(response([], [req.params.courseShortName], ["Course not found"]))
    }

    const courseId = courseDetail.data.courses[0].id

    const detail = await Promise.all(req.body.user.map(async email => {
        const enrolRes = await enrolUser(3, email, courseId)
        return { email: email, detail: enrolRes }
    }))

    let dataRes = {
        successes: [],
        errors: [],
        errorDetails: []
    }

    for(let i = 0; i < detail.length; i++) {
        if (detail[i].detail.successes) {
            dataRes.successes.push(detail[i].email)
        } else {
            dataRes.errors.push(detail[i].email)
            dataRes.errorDetails.push("User not found")
        }
    }

    res.json(response(dataRes.successes, dataRes.errors, dataRes.errorDetails))
})

routes.post('/course/:courseShortName/unenrol', [
    check('user', 'user invalid, user field must be a array').exists().isArray()
], async (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return next(errorHandle(400, errors.mapped()))
    }

    const paramsCourseDetail = new URLSearchParams()
    paramsCourseDetail.append('wstoken', MOODLE_TOKEN)
    paramsCourseDetail.append('wsfunction', 'core_course_get_courses_by_field')
    paramsCourseDetail.append('moodlewsrestformat', MOODLE_FORMAT)
    paramsCourseDetail.append('field', 'shortname')
    paramsCourseDetail.append('value', req.params.courseShortName)

    const courseDetail = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, paramsCourseDetail)

    if (!courseDetail.data.courses[0]) {
        res.statusCode = 404
        return res.json(response([], [req.params.courseShortName], ["Course not found"]))
    }

    const courseId = courseDetail.data.courses[0].id

    const detail = await Promise.all(req.body.user.map(async email => {
        const enrolRes = await unenrolUser(email, courseId)
        return { email: email, detail: enrolRes }
    }))

    let dataRes = {
        successes: [],
        errors: [],
        errorDetails: []
    }

    for(let i = 0; i < detail.length; i++) {
        if (detail[i].detail.successes) {
            dataRes.successes.push(detail[i].email)
        } else {
            dataRes.errors.push(detail[i].email)
            dataRes.errorDetails.push("User not found")
        }
    }

    res.json(response(dataRes.successes, dataRes.errors, dataRes.errorDetails))
})

routes.post('/course/:courseShortName/duplicate', [
    check('fullName', 'fullName invalid').exists(),
    check('shortName', 'shortName invalid').exists(),
    check('categoryId', 'categoryid invalid').exists().isNumeric(),
    check('startDate', 'startDate invalid').exists().isISO8601(),
    check('stopDate', 'stopDate invalid').exists().isISO8601()
], async (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return next(errorHandle(400, errors.mapped()))
    }

    const paramsCourseDetail = new URLSearchParams()
    paramsCourseDetail.append('wstoken', MOODLE_TOKEN)
    paramsCourseDetail.append('wsfunction', 'core_course_get_courses_by_field')
    paramsCourseDetail.append('moodlewsrestformat', MOODLE_FORMAT)
    paramsCourseDetail.append('field', 'shortname')
    paramsCourseDetail.append('value', req.params.courseShortName)
    

    const courseDetail = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, paramsCourseDetail)

    if (!courseDetail.data.courses[0]) {
        res.statusCode = 404
        return res.json(response([], [req.params.courseShortName], ["Course not found"]))
    }

    const courseId = courseDetail.data.courses[0].id

    const paramsDuplicateCourse = new URLSearchParams()
    paramsDuplicateCourse.append('wstoken', MOODLE_TOKEN)
    paramsDuplicateCourse.append('wsfunction', 'core_course_duplicate_course')
    paramsDuplicateCourse.append('moodlewsrestformat', MOODLE_FORMAT)
    paramsDuplicateCourse.append('courseid', courseId)
    paramsDuplicateCourse.append('fullname', req.body.fullName)
    paramsDuplicateCourse.append('shortname', req.body.shortName)
    paramsDuplicateCourse.append('categoryid', req.body.categoryId)
    paramsDuplicateCourse.append('options[0][name]', 'users')
    paramsDuplicateCourse.append('options[0][value]', 0)

    const duplicateCourse = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, paramsDuplicateCourse)

    if(duplicateCourse.data.exception) {
        res.statusCode = 400
        return res.json(response([], [req.body.shortName], [duplicateCourse.data]))
    }

    const startDate = moment(req.body.startDate, 'YYYY-MM-DD HH:mm:ss').unix()
    const stopDate = moment(req.body.stopDate, 'YYYY-MM-DD HH:mm:ss').unix()

    const paramsUpdateCoures = new URLSearchParams()
    paramsUpdateCoures.append('wstoken', MOODLE_TOKEN)
    paramsUpdateCoures.append('wsfunction', 'core_course_update_courses')
    paramsUpdateCoures.append('moodlewsrestformat', MOODLE_FORMAT)
    paramsUpdateCoures.append('courses[0][id]', duplicateCourse.data.id)
    paramsUpdateCoures.append('courses[0][startdate]', startDate)
    paramsUpdateCoures.append('courses[0][enddate]', stopDate)

    const updateCoures = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, paramsUpdateCoures)

    res.json(response([{ courseId: duplicateCourse.data.id, shortName: duplicateCourse.data.shortname }], [], []))
})

const unenrolUser = async (email, courseId) => {
    const paramsUserDetail = new URLSearchParams()
    paramsUserDetail.append('wstoken', MOODLE_TOKEN)
    paramsUserDetail.append('wsfunction', 'core_user_get_users')
    paramsUserDetail.append('moodlewsrestformat', MOODLE_FORMAT)
    paramsUserDetail.append('criteria[0][key]', 'email')
    paramsUserDetail.append('criteria[0][value]', email)

    const userDetail = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, paramsUserDetail)

    if (!userDetail.data.users.length) {
        return { error: "user not found" }
    }

    const paramsEnrolUser = new URLSearchParams()
    paramsEnrolUser.append('wstoken', MOODLE_TOKEN)
    paramsEnrolUser.append('wsfunction', 'enrol_manual_unenrol_users')
    paramsEnrolUser.append('moodlewsrestformat', MOODLE_FORMAT)
    paramsEnrolUser.append('enrolments[0][userid]', userDetail.data.users[0].id)
    paramsEnrolUser.append('enrolments[0][courseid]', courseId)

    const courseDetail = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, paramsEnrolUser)
    return { successes: "add user to course" }
}

const enrolUser = async (roleId, email, courseId) => {
    const paramsUserDetail = new URLSearchParams()
    paramsUserDetail.append('wstoken', MOODLE_TOKEN)
    paramsUserDetail.append('wsfunction', 'core_user_get_users')
    paramsUserDetail.append('moodlewsrestformat', MOODLE_FORMAT)
    paramsUserDetail.append('criteria[0][key]', 'email')
    paramsUserDetail.append('criteria[0][value]', email)

    const userDetail = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, paramsUserDetail)

    if (!userDetail.data.users.length) {
        return { error: "user not found" }
    }

    const paramsEnrolUser = new URLSearchParams()
    paramsEnrolUser.append('wstoken', MOODLE_TOKEN)
    paramsEnrolUser.append('wsfunction', 'enrol_manual_enrol_users')
    paramsEnrolUser.append('moodlewsrestformat', MOODLE_FORMAT)
    paramsEnrolUser.append('enrolments[0][roleid]', roleId)
    paramsEnrolUser.append('enrolments[0][userid]', userDetail.data.users[0].id)
    paramsEnrolUser.append('enrolments[0][courseid]', courseId)

    const courseDetail = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, paramsEnrolUser)
    return { successes: "add user to course" }
}

export default routes
