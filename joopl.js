﻿// (c) joopl
// By Matías Fidemraizer (http://www.matiasfidemraizer.com) (http://www.linkedin.com/in/mfidemraizer/en)
// -------------------------------------------------
// http://joopl.codeplex.com
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Keywords
var $namespace = null; // Holds an object to manage namespaces
var $def = null; // Declares a class
var $interfacedef = null; // A shortcut to $interface.declare(...)
var $implements = null; // Holds a function to check if an object implements an interface
var $global = {}; // Represents the global scope.

(function (undefined) {
    "use strict";

    var version = "2.2.0";

    // An object containing a set of core features used by jOOPL
    var TypeUtil = {
        // Determines if some identifier is a jOOPL keyword.
        isSystemReservedName: function (name) {
            var reserved = false

            switch (name.toLowerCase()) {
                case "$ctor":
                case "$bctor":
                case "$global":
                case "$def":
                case "$interfacedef":
                case "$new":
                case "$namespace":
                case "$extends":
                case "$implements":
                case "$_":
                case "joopl":
                case "typeKind":
                    return true;

                default:
                    return false;
            }
        },

        //  Creates a property on the given class definition based on a provided property descriptor.
        // @classDef: The class definition (it must be the constructor function!
        // @name: The property name
        // @descriptor: An object representing the property descriptor
        // @context: An optional context object that will work as the "this" keyword binder for the getter and/or setter when defining the property.
        createPropertyFromDescriptor: function (classDef, name, descriptor, context) {
            if (context) {
                if (descriptor.get) {
                    descriptor.get = descriptor.get.bind(context);
                }

                if (descriptor.set) {
                    descriptor.set = descriptor.set.bind(context);
                }
            }

            Object.defineProperty(
                context ? context : classDef.prototype,
                name,
                descriptor
            );
        },

        // Creates a property.
        // @classDef: A class definition (it must be the class constructor function).
        // @name: The property name.
        // @getter: The getter parameterless function.
        // @setter: The setter function with a parameter representing the value to set.
        // @inmutable: A boolean flag specifying if the created property is configurable or not.
        createProperty: function (classDef, name, getter, setter, inmutable) {
            if (inmutable == undefined) {
                inmutable = false;
            }

            if (!classDef.prototype.hasOwnProperty(name)) {
                // This case is for a read-write property
                if (getter && setter) {

                    Object.defineProperty(
                        classDef.prototype,
                        name, {
                            get: getter,
                            set: setter,
                            configurable: !inmutable,
                            enumerable: true
                        }
                    );
                } else if (getter) { // This case is for a read-only property
                    Object.defineProperty(
                        classDef.prototype,
                        name, {
                            get: getter,
                            configurable: !inmutable,
                            enumerable: true
                        }
                    );
                } else if (setter) { // This case is for a write-only property
                    Object.defineProperty(
                        classDef.prototype,
                        name, {
                            set: setter,
                            configurable: !inmutable,
                            enumerable: true
                        }
                    );
                }
            }
        },

        createEvent: function (source, name) {
            if (source.hasOwnProperty(name)) {
                throw Error("The source object has already defined an event called '" + name + "'");
            }
            var eventManager = new $global.joopl.EventManager({ source: source });

            Object.defineProperty(
                source,
                name,
                {
                    get: function () {
                        return eventManager[name];
                    },
                    set: function (value) {
                        eventManager[name] = value;
                    },
                    configurable: false,
                    enumerable: true
                }
            );

            eventManager.register(name);
        },

        // Builds a class instance into a full jOOPL object supporting inheritance and polymoprhism, and calls the constructor of the whole class instance.
        // @instance: The class instance
        // @args: The constructor arguments.
        buildObject: function (instance, args, callConstructor) {
            if (typeof instance.$base == "function") {
                instance.$base = new instance.$base(args, false);
                instance.$_ = instance.$base.$_;
            } else {
                instance.$_ = {};
            }

            if (callConstructor) {
                instance.$ctor.call(instance, args);
            }

            if (instance.$base != null && instance.$base != undefined && instance.$base.$base != null && instance.$base.$base != undefined) {
                instance.$_.$base = instance.$base.$base;
            }

            instance.$_.$derived = instance;

            return instance;
        },

        // Builds a given class inheritance with the given parent class.
        // @derived: The child class.
        // @parent: The parent class.
        buildInheritance: function (derived, parent) {
            if (parent != null) {
                // Adding all class fields to the derived class...
                for (var fieldName in parent.prototype.$_) {
                    if (!derived.prototype.$_[fieldName]) {
                        derived.prototype.$_[fieldName] = parent.prototype.$_[fieldName];
                    }
                }

                var propertyDescriptor = null;

                // Adding both methods and properties to the derived class...
                for (var memberName in parent.prototype) {
                    propertyDescriptor = Object.getOwnPropertyDescriptor(parent.prototype, memberName);

                    // If it has a property descriptor...
                    if (propertyDescriptor) {
                        // and the value of the descriptor is a function it means that it's inheriting a method.
                        if (typeof propertyDescriptor.value == "function") {
                            derived.prototype[memberName] = parent.prototype[memberName];
                        } else { // If not, it is a property accessor.
                            this.createPropertyFromDescriptor(derived, memberName, propertyDescriptor);
                        }
                    } else if (typeof parent.prototype[memberName] == "function") { // It can also happen that it's a function defined in the $global.joopl.Object prototype...
                        derived.prototype[memberName] = parent.prototype[memberName];
                    }
                }
            }

            return parent ? parent.prototype : null;
        },

        // Whether determines if some object reference has an associated value (object) and returns true/false.
        // @someRef: The object reference.
        hasValue: function (someRef) {
            return someRef !== undefined && someRef != null;
        },

        // Whether determines if some object reference holds a function and returns true/false.
        // @someRef: The object reference.
        isFunction: function (someRef) {
            return typeof someRef === "function";
        }
    };

    Object.freeze(TypeUtil);


    /**
    The `$namespace` keyword represents an static object holding methods/functions to manage namespaces.

    ### What is a namespace?
    <p>A namespace is an identifier holding zero or more members like classes. </p>

    <p>In object-oriented programming namespaces are a key and strong feature, since it prevents name collisions: for example, two or more classes can live 
    into the same code library, but since each one belongs to a different namespace, this can happen with no issues:</p>

        MyNamespace.Class1
        MyNamespace.MyOtherNamespace.Class1
        MyNamespace.AnotherNamespace.Class1
        YetAnotherNamespace.Class1

    <p>Namespaces <strong>must be defined using the <a href="#method_register">$namespace.register</a></strong> method.</p>

    <p>Once some code requires to use these classes, it can access the right class by using the full namespace path:</p>

        var instance = new $global.MyNamespace.Class1();
        var instance2 = new $global.$MyNamespace.MyOtherNamespace.Class1();
        var instance3 = new $global.$MyNamespace.AnotherNamespace.Class1();
        var instance4 = new $global.YetAnotherNamespace.Class1();

    <p>This is very useful in order to let different JavaScript libraries define classes with exactly the same name but doing absolutely different things. Namespaces
    isolate each one.</p>

    <h3 id="namespace-global">The $global namespace</h3>
    <p>jOOPL has a top-most namespace called `$global`. Any namespace registered using the whole `$namespace.register(...)` method will be nested into the
    `$global` namespace.</p>
    <p>As JavaScript top-most object is the `Window` object and any variable or function defined in the global scope belongs to `Window`, this can lead to
    bad practices, because more than a JavaScript library may define the same variable names, functions and other constructs. jOOPL isolates any member
    defined by itself in the `$global` namespace in order to prevent issues with other libraries.</p>

    @class $namespace
    */
    $namespace = {
        /**
        Registers a namespace. The whole method supports two scenarios:

        - Register a namespace and later add members by accessing it with its full path (i.e. $global.your.namespace).
        - Register a namespace and create a scoped function where the `this` keyword holds the registered namespace.

        In both scenarios, jOOPL will check if the whole namespace path is already registered. If it is not the case, it will register the
        namespace path, and if it was already registered, it just skips the namespace path registration.
        
        ####1. Simple register a namespace
        The first use case of the `$namespace.register` method is just about registering a namespace and later access it with its full path:
            
            $namespace.register("joopl.samples");

            $global.joopl.samples.SomeClass = $def({ 
                $members: {
                    someMethod: function() {}
                }
            });

        ####2. Register a namespace and add classes or other members inside a scoped function
        The second use case of the `$namespace.register` is the most powerful one: both register the whole namespace and add members to the
        it in the same operation and with a shorter syntax. 

        `$namespace.register` supports a second parameter in addition to the namespace path called `scopedFunc`. It is a parameterless function that, when
        executed,  the `this` keyword in the scope of the function (i.e. *the function body*) will be the childest registered namespace. For example:

            $namespace.register("joopl.samples", function() {
                // The this keyword now is the 'samples' namespace! 
                // That's great because there is no need to access to the full namespace path
                // to work on adding members to it!
                this.ClassA = $def({
                    $members: {
                        someMethod: function() {
                            return "hello world";
                        }
                    }
                })
            });

       @method register
       @param path {String} A namespace path. For example, "joopl.sample" will register "joopl" and its child "sample". 
       @param copedFunc {Function} A parameterless function representing the scope where the `this` keyword is the childest registered namespace (for example, registering "joopl.sample', the `this` keyword will be the *sample* namespace).
        */
        register: function (path, scopedFunc) {
            var nsIdentifiers = typeof path == "string" ? path.split(".") : null;

            // The parent namespace of everything is the reserved $global object!
            var parentNs = $global;
            var currentNs = null;

            for (var nsIndex = 0; nsIndex < nsIdentifiers.length; nsIndex++) {
                currentNs = nsIdentifiers[nsIndex];

                // The current namespace  is not registered (if evals true)
                if (!parentNs[currentNs]) {
                    parentNs[currentNs] = {};

                    // Any namespace will hold an "isNamespace" property
                    // in order to correctly identify if an object within
                    // the namespaces is a namespace or a class!
                    Object.defineProperty(
                        parentNs[currentNs], "isNamespace", {
                            value: true,
                            configurable: false,
                            enumerable: true
                        });
                }

                parentNs = parentNs[currentNs];
            }

            // If the second parameter holds something if should be a 
            // parameterless function, and this is creating a namespace scope.
            if (typeof scopedFunc == "function") {
                $namespace.using(path, scopedFunc, true);
            }
        },

        /** 
        Aliases an existing namespace.
        @method alias
        @param namespace {Object} The namespace to alias
        @param alias {String} The alias
        @example
            $namespace.register("joopl.samples");
            $namespace.alias($global.joopl.samples, "samples");
        */
        alias: function (namespace, alias) {
            $global[alias] = namespace;
        },

        /**
        Imports the members of given namespace path.

        The `$namespace.using` method will not register a namespace if a given namespace path is not previously registered with `$namespace.register`.


        ####1. Importing all members from some given namespaces into a variable
        If the `$namespace.using` method is called only giving the first input parameter `paths` (*an arrary of strings where each index is a namespace path*).

        That is, if a namespace has been previously registered this way in some JavaScript file:
            
            $namespace.register("joopl.samples");
            $namespace.register("jooopl.samples.ui");

        ...`$namespace.using` would be used like this:

            var importedMembers = $namespace.using(["joopl.samples", "joopl.samples.ui"]);

        The `importedMembers`variable will hold *all* imported classes, interfaces or anything within the `samples` and `ui` namespaces.

        ####2. Importing all members in a scoped function
        The second use case is importing the members from some given namespaces into a scoped function:

            $namespace.register("joopl.samples", function() {
                this.ClassA = $def({
                    $members: {
                        someMethod: function() {
                        }
                    }
                })
            });



            // Somewhere in the same or other file...
            $namespace.using(["joopl.samples", "joopl.samples.ui"], function() {
                // The "this" keyword contains an object with all imported members from the both namespaces
                var instance = new this.ClassA();
            });

        In addition, there is a variation: if the scoped function has a single input parameter, jOOPL will import all members into the whole input argument
        and the `this` keyword will hold the `$global` object:

            $namespace.using(["joopl.samples", "joopl.samples.ui"], function(scope) {
                // The scope input argument will hold the imported members
                var instance = new scope.ClassA();
            });



        @method using
        @param paths {Array} An array of strings of the namespaces to import
        @param scopedFunc {Function} A function to create a namespace scope (optional)
        @param scopeIsNs {boolean} USED BY THE SYSTEM. IT IS NOT RECOMMENDED FOR DEVELOPERS. A boolean flag specifying if the this keyword in the scoped function must be the childest namespace or not (optional)
        */
        using: function (paths, scopedFunc, scopeIsNs) {
            if (paths === undefined) {
                debugger;
                throw new $global.joopl.ArgumentException({ argName: "namespace path", reason: "No namespace path has been provided" });
            }

            if (typeof paths == "string") {
                if (paths.length == 0) {
                    debugger;
                    throw new $global.joopl.ArgumentException({ argName: "namespace path", reason: "No namespace path has been provided" });
                }

                paths = [paths];
            }

            if (paths.length == 0) {
                debugger;
                throw new $global.joopl.ArgumentException({ argName: "namespace path", reason: "No namespace path has been provided" });
            }

            var nsIdentifiers = null;
            var currentNs = $global;
            var nsIndex = 0;
            var namespaces = [];

            for (var pathIndex in paths) {
                nsIdentifiers = paths[pathIndex].split(".");

                for (nsIndex = 0; nsIndex < nsIdentifiers.length; nsIndex++) {
                    currentNs = currentNs[nsIdentifiers[nsIndex]];

                    if (!currentNs) {
                        debugger;
                        throw new $global.joopl.ArgumentException({
                            argName: "namespace path",
                            reason: "The namespace path '" + paths[pathIndex] + "' is not valid because the namespace '" + nsIdentifiers[nsIndex] + "' is not declared"
                        });
                    }
                }

                namespaces.push(currentNs);
                currentNs = $global;
            }

            var nsScope = {};
            var tempMember = null;

            for (nsIndex in namespaces) {
                for (var typeName in namespaces[nsIndex]) {
                    if (!nsScope[typeName]) {
                        tempMember = namespaces[nsIndex][typeName];

                        if ((tempMember.prototype !== undefined && !tempMember.prototype.joopl !== undefined) || tempMember.joopl !== undefined) {
                            nsScope[typeName] = tempMember;
                        }
                    }
                    else {
                        throw Error("A type called '" + typeName + "' in current context from another namespace already exists. Create an alias or use a full namespace paths");
                    }
                }
            }

            Object.preventExtensions(nsScope);

            if (scopedFunc !== undefined && typeof scopedFunc == "function") {
                if (scopeIsNs) {
                    scopedFunc.bind(namespaces[nsIndex])();
                } else if (scopedFunc.length == 0) {
                    scopedFunc.bind(nsScope)();
                } else {
                    scopedFunc.bind($global)(nsScope);
                }

                return null;
            } else {
                return nsScope;
            }
        }
    };

    Object.freeze($namespace);

    $implements = function (clazz, someInterface) {
        for (var interfaceMember in someInterface.prototype) {
            if (
                    TypeUtil.isFunction(someInterface.prototype[interfaceMember])
                    &&
                    (
                        !TypeUtil.isFunction(clazz.prototype[interfaceMember])
                        || clazz.prototype[interfaceMember] === undefined
                        || clazz.prototype[interfaceMember].length !== someInterface.prototype[interfaceMember].length
                    )
            ) {
                return { success: false, memberName: interfaceMember };
            }
        }

        return { success: true, memberName: null };
    };

    Object.freeze($implements);

    $interfacedef = function (args) {
        var interfaceDef = function () {
        };

        interfaceDef.prototype.joopl = version;

        Object.defineProperty(interfaceDef.prototype, "typeKind", { value: MemberKind.Interface, enumerable: true });

        if (typeof args.$extends != "Array") {
            TypeUtil.buildInheritance(interfaceDef, args.$extends);
        }
        else {
            for (var interfaceIndex = 0; interfaceIndex < args.$extends.length; interfaceIndex++) {
                TypeUtil.buildInheritance(interfaceDef, args.$extends[interfaceIndex]);
            }
        }

        if (args.$members) {
            for (var memberName in args.$members) {
                interfaceDef.prototype[memberName] = args.$members[memberName];
            }
        }

        return interfaceDef;
    };

    Object.freeze($interfacedef);

    /**
    ## <a id="index"></a> Index

    * 1.0\. [Defining a class](#class-define)
        * 1.1\. [Fields](#class-fields)
        * 1.2\. [Constructors](#class-constructors)
        * 1.3\. [Properties](#class-properties)
        * 1.4\. [Methods/Functions](#class-methods)
        * 1.5\. [Events](#class-events)
    * 2.0\. [Creating instances of classes - the `new` operator](#class-instances)
    * 3.0\. [Object-oriented programming on JavaScript with jOOPL](#class-oop)
        * 3.1\. [Class inheritance](#class-inheritance)
        * 3.2\. [Inheritance with polymorphism](#class-polymorphism)
            * 3.2.1\. [The `this.$base` keyword](#class-base)
            * 3.2.2\. [The derived class constructor calls the parent's class constructor](#class-baseconstructor)
            * 3.2.3\. [A base class member calls the most specialized implementation](#class-basecallsderived)
        * 3.3\. [The isTypeOf operator](#class-istypeof)

    <h3 id="class-define">1. Defining a class</h3> 
    ([Back to index](#index))

    The `$def` operator is required in order to define classes. In fact, `$def` is a function and it accepts an object of arguments as
    input parameter. The essential parameters are:

    - **$constructor** *(optional)*. The constructor of the class is a method called first when an instance of some class is created. If no constructor is provided, jOOPL automatically creates a default parameterless constructor.
    - **$members** *(optional)*. An object containing the methods and properties for the whole class.

    A basic class may look like the next code listing:

        var A = $def({
            // Constructor 
            $constructor: function() {
                this.$_.name = null;
            },
            $members: {
                get name() {
                    return this.$_.name;
                }

                set name(value) {
                    this.$_.name = value;
                }

                sayYourName: function() {
                    alert("Hey, " + this.name)
                }
            }
        });

    
    <h4 id="class-fields">1.1 Class fields</h4> 
    ([Back to index](#index))

    A class field is a variable declared in the class that can be accessed from any member (constructors, properties and methods).

    Any class constructor, property or method has a reserved variable called `$_` accessible through `this.$_` on which class fields can be declared and
    manipulated. For example, `this.$_.myName = "Matias";` will declare a class field called `myName` with a default value `Matías`.

        var A = $def({
            $constructor: function() {
                // This is a class field:
                this.$_.value = "A string for the class field";
            }
        });

    <h4 id="class-constructors">1.2 Constructors</h4>
    ([Back to index](#index))

    In classes, the constructor is a method/function called once an instance of some class is created. That is, this is a good moment for initializing 
    the whole class.

    For example, class constructors are the place to define class fields:

        var A = $def({
            // Constructor 
            $constructor: function() {
                this.$_.myName = "Matias";
            }
        });

    In instance, the class constructor has access to the already declared methods and properties:

        var A = $def({
            // Constructor 
            $constructor: function() {
                this.$_.myName = "Matias";

                // The "someMethod()" method can be called from the constructor!
                this.initialize();
            }

            $members :{
                initialize: function() {
                    alert("hello world called from the constructor!")
                }
            }
        });

    ##### See also

    - [Call parent class constructor](#class-baseconstructor)

    <h4 id="class-properties">1.3 Properties</h4>
    ([Back to index](#index))

    Any class can declare properties. Apparently, a property looks like a variable in its usage, but it differs from variables on
    how they are declared.

    Properties are the best way to encapsulate the access to private resources held by the class like class fields or calculated values. 

    A property is composed by two possible parts (it can have both or only one of them)
    
    - **Getter**. It is a block like a function defining how a value is obtained.
    - **Setter**. It is a block like a function defining how to set a value.

    For example, without properties, an object would look like the next code listing:

        var myObject = {
            name: "Matias",
            age: 28
        };

    And once the `myObject` variable holds the new object, both `name` and `age` can be altered:

        myObject.name = "John";
        myObject.age = 33;

    But what happens if there is a need to constraint the `name` and `age` variables? A primitive solution would be:

        var possibleName = "John";
        var possibleAge = 33;

        if(possibleName != "John") {
            myObject.name = possibleName;
        } else {
            throw Error("Sorry, John, I do not like you!")
        }

        if(possibleAge > 30) {
            myObject.age = possibleAge;
        } else {
            throw Error("You are too young! Please try again in some years...");
        }

    This is how the above code would be implemented using properties:

        var myObject = {
            // Some regular variables
            _name: null,
            _age: null,

            // A getter for the _name variable:
            get name() { 
                return this._name; 
            },
            // A setter for the _name variable. The setter defines the validation logic!
            set name(value) { 
                if(value != "John") {
                    this._name = value; 
                } else {
                    throw Error("Sorry, John, I do not like you!")
                }
            },

            // A getter for the _name variable:
            get age() { 
                return this._age;
            },
            // A setter for the _name variable. The setter also defines the validation logic here!
            set age(value) {
                if(value > 30) {
                    myObject.age = value;
                } else {
                    throw Error("You are too young! Please try again in some years...");
                }
            }
        }

    Now, if some code tries to assign "John" or an age lesser than 30, the properties setters will throw the error, but this time
    the validation logic is encapsulated:

        myObject.name = "John" // ERROR
        myObject.name = "Matias" // OK

        myObject.age = 28 // ERROR
        myObject.age = 33 // OK

    jOOPL fully supports JavaScript 1.8.x properties like the described before:

        var A = $def({
            $constructor: {
                // Define a class field for later provide access to it through a property getter and setter
                this.$_.name = null;
            },
            $members: {
                // Gets the value held by the this.$_.name class field:
                get name() {
                    return this.$_.name;
                },

                // Sets a new value to the this.$_.name class field:
                set name(value) {
                    this.$_.name = value;
                }
            }
        });

        var instance = new A();

        // Set the 'name' property value
        a.name = "Matias";

        // Gets the name property value
        alert(a.name); // Alerts "Matias"


    <h4 id="class-methods">1.4  Methods/Functions</h4>
    ([Back to index](#index))

    Methods (*also known as functions*) are the behavior of classes. They are the actions that can be performed by the class. Examples
    of methods can be:

    - do
    - create
    - notify
    - write
    - build
    - ...

    Class methods are defined as regular JavaScript functions and as part of the `$members` in a class definition:

        var A = $def({
            $members: {
                do: function() {
                    return "do what?";
                }
            }
        });

    ##### See also

    - [Polymorphism](#class-polymorphism)

    <h4 id="class-events">1.5 Events</h4> 
    ([Back to index](#index))

    ##### Events glossary

    - **Event**. It is an observable action. Classes defining them or others can subscribe to events and react to them.
    - **Event handler**. It is a function assigned to the event which is called when the event happens.

    Events are the new jOOPL's out-of-the-box feature that enables any class to create observable objects.

    An observable object is a one emitting notifications when something happens within it. For example, an event may be:

    + When some button is clicked.
    + An asynchronous operation completed.
    + An item was added to a list.

    Events are class members like properties and methods, but they are special in terms of how they are declared. For example, 
    if a class needs to implement an event to notify to others that it said "hello world", an event "saying" would be declared this way:

        var A = $def({
            $members: {
                $events: ["saying"]
            }
        });

    The above code declares an event "saying". Events are declared as an array of identifiers (names) as value of the `$events` special member. Once
    an event is declared, the next step is triggering/raising/firing it somewhere in the whole class:
        
        var A = $def({
            $members: {
                $events: ["saying"],

                helloWorld: function() {
                    // This is triggering the event. jOOPL has created an special function called
                    // 'saying' which can receive an object of arguments so the object suscribed to
                    // the class event will receive the whole argument 'text'
                    this.saying({ text: "yes, the object is about to say 'hello world'!"});

                    // The event 'saying' notified that the class A was about saying something
                    // and, finally, now it says "hello world!" using an alert.
                    alert("hello world!")
                }
            }
        });

    Finally, the last step is listening for the `saying` event. For that matter, an instance of A is created and the code will set an event handler in order
    to do an action when the `A` class instance says something:

        var instance = new A();

        instance.saying = function(args) {
            // The `args` input argument will hold the text set when the event was triggered
            alert("The instance said: " + args.text);
        };

    Once an event handler added to an event, it is possible to *unsuscribe* from it: it is as easy as trying to set the same handler to the event.

    For example:

        var instance = new A();

        var handler = function(args) {
        }

        // This adds an event handler to the event
        instance.saying = handler;

        // Setting the same handler again removes it from the event.
        instance.saying = handler;

    
    <h3 id="class-instances">2. Creating instances of classes</h3>
    ([Back to index](#index))

    Once a class is defined using the `$def` keyword, an instance of the class must be created in order to use it. 

    In jOOPL and JavaScript, a class is a standard constructor function and instances can be created using also the standard
    `new` operator:

        var A = $def({
            $members: {
                someMethod: function() {
                    alert("hello world");
                }
            }
        });

        // Creating an instance of A:
        var instance = new A();

        // Now the instance variable - a reference to an object of type A - 
        // has its instance methods available to be called:
        instance.someMethod();

    <h3 id="class-oop">3. Object-oriented programming on JavaScript using jOOPL</h3> 
    ([Back to index](#index))
    
    Defining classes and creating instances of it using the `$def` and `new` operator respectively are just the most basic features of jOOPL.

    jOOPL introduces an state-of-the-art and powerful class inheritance and polymoprhism mechanism that elevates the JavaScript language to 
    what makes something true object-oriented programming:

    - **Inheritance**. Classes can inherit from others in order to share their behaviors, properties and events.
    - **Polymorphism**. Class methods can be overriden by derived classes (ones inheriting a base class), keep the inherited members signature but alter their implementation.
    - **Encapsulation**. Classes expose their behavior thanks to their members, and the implementation details are hidden to the code consuming a class.
    
    <h4 id="class-inheritance">3.1 Class inheritance</h4>
    ([Back to index](#index))

    Inheritance is one of the most important concepts in object-oriented programming. That is, some class can derive from other.

    The `$def` keyword supports an additional and optional parameter called `$extends` which specifies that the declaring class extends another class.

    A class `A` may implement some methods and properties and a class `B` can inherit `A` and it will not need to implement them as all members from `A`
    are already available as members of `B`:

        // Defining a class A having a method "do()"
        var A = $def({
            $members: {
                do: function() {
                    // Do some stuff
                }
            }
        });

        // Class B extends A
        var B = $def({
            $extends: A
        });

        var instance = new B();

        // The B instance can invoke the do() function 
        // inherited from A
        instance.do();

    jOOPL supports single inheritance. It means that a class can derive another class but not from multiple classes (*no multi-inheritance*), but any
    class can inherit other. There is no limitation of how many levels of inheritance can implement an hierarchy. 

    An important detail is that, if a class does not directly inherit a class (there is no `$extend` input parameter for `$def` keyword), it will 
    implicitly inherit the top-most class `Object` implemented as a plain JavaScript prototype, which provides basic methods and properties that any class 
    will contain. At the end of the day, **any class inherits Object**.

    <h4 id="class-polymorphism">3.2 Inheritance with polymorphism </h4>
    ([Back to index](#index))

    Polymorphism is a key feature and it is tied to inheritance: it is the ability of an inherited member - methods and properties - to override the base
    implementation found in the parent class. 

    For example, there is a class called `Salutation` which implements a method/function `sayHello` and it returns **"hello world"**, and there is a derived class
    `SpecializedSalutation` that inherits `Salutation` class, the whole derived class can override the `sayHello` method and make it say **"Hello, world!"**:

        var Salutator = $def({
            $members: {
                sayHello: function() {
                    return "hello world"
                }
            }
        });

        var SpecializedSalutator = $def({
            $extends: Salutator,
            $members: {
                // Overrides the parent class sayHello implementation
                sayHello: function() {
                    return "Hello, world!";
                }
            }
        });

        var instance = new SpecializedSalutator();
        var text = instance.sayHello();

        // This will alert "Hello, world!" as the class has overriden the default implementation
        // which was returning "hello world"
        alert(text); 

    <h4 id="class-base">3.2.1 The `this.$base` keyword</h4>
    ([Back to index](#index))

    Any method/function or property is overridable. But what makes polymorphism even more powerful is the chance to call the base implementation from the
    overriden member.

    The overriden members may or may not call the parent class member implementation using the `this.$base` keyword. 

    For example, there is a class `Calculator` having a method `add`, and a specialized calculator called `UnsignedCalculator` which makes any addition an absolute result,
    the code would look like this:

        var Calculator = $def({
            $members: {
                add: function(num1, num2) {
                    // It simply adds num2 to num1
                    return num1 + num2;
                }
            }
        });

        var UnsignedCalculator = $def({
            $members: {
                add: function(num1, num2) {
                    // This is calling the "add"'s parent class implementation
                    var result = this.$base.add(num1, num2);

                    // Now the result from calling the base implementation of this method
                    // is converted to an unsigned number
                    return Math.abs(result);
                }
            }
        });

    <h4 id="class-baseconstructor">3.2.2 The derived class constructor calls the parent's class constructor</h4> 
    ([Back to index](#index))

    Even class constructors can call their parent class constructor. This is extremely useful if the parent class or another class in the same
    hierarchy requires some construction-time initialization:

        // The top-most parent class Person defines basic data
        // and provides getter and setter properties in order to
        // get or set the whole contained data.
        //
        // The constructor receives as arguments the default data.
        var Person = $def({
            $constructor: function(args) {
                this.$_.name = args.name;
                this.$_.secondName = args.secondName;
                this.$_.age = args.age;
            },
            $members: {
                get name() {
                    return this.$_.name;
                },
                set name(value) {
                    this.$_.name = value;
                },

                get secondName() {
                    return this.$_.secondName;
                },
                set secondName(value) {
                    this.$_.secondName = value;
                }

                get age(){
                    return this.$_.age;
                },
                set age(value) {
                    this.$_.age = value;
                }
            }
        });

        // The Employee class inherits Person and adds
        // more data. The Employee constructor both defines
        // new class fields and calls the Person's constructor
        // by invoking this.$base.$ctor(args), thus the base constructor
        // will receive the expected arguments.
        var Employee = $def({
           $extends: Person,
           $constructor: function(args) {
                this.$base.$ctor(args);

                this.$_.companyName = args.companyName;
                this.$_.salary = args.salary;
           } 
        });

        // Now this is creating an instance of Employee. As the Employee constructor
        // calls its base Person class' constructor, it will be correctly initialized 
        // with the data passed as constructor arguments:
        var instance = new Employee({
            name: "Matias",
            secondName: "Fidemraizer",
            age: 28,
            companyName: "ACME",
            salary: 99999
        });

        alert(instance.name); // Popups "Matias"
        alert(instance.secondName); // Popups "Fidemraizer"
        alert(instance.age); // Popups "28"
        alert(instance.companyName); // Popups "ACME"
        alert(instance.salary); // Popups "99999"

    <h4 id="class-basecallsderived">3.2.3 A base class member calls the most specialized implementation</h4> 
    ([Back to index](#index))

    Sometimes it is needed that some method or property in the base class may able to call some most specialized member implementation.

    For example, a parent class `Polygon` overrides the default JavaScript `toString()` method in order to calculate the polygon area and
    return it as a string. That is, `Polygon` implements a `calcArea` method. Now `Square` inherits `Polygon` and overrides the `calcArea`
    method and performs the whole area calculation. The `Square` class will now need to override the base `toString()` `Polygon`'s method in order to
    show the area.

    In jOOPL, the most derived or specialized member is accessed through the special class field `this.$_.$derived`. 

    Here is a sample of the above explanation:

        var Polygon = $def({
            $members: {
                calcArea: function() {
                    // A generic polygon will not know how to calculate the area. The
                    // derived classes will do it!
                },

                toString: function() {
                    // See how calcArea() from the most derived class is accessed:
                    return "The area of this polygon is: '" + this.$_.$derived.calcArea(); + "'";
                }
            }
        });

        var Square = $def({
            $constructor: function(args) {
                this.$_.x = args.x;
                this.$_.y = args.y;
            },
            $extends: Polygon,
            $members: {
                get x() {
                    return this.$_.x;
                },
                get y() {
                    return this.$_.y;
                },

                calcArea: function() {
                    return this.x * this.y;
                }
            }
        });

        var instance = new Square(20, 30);
        
        // This will alert "The area of this polygon is: '600'""
        alert(instance.toString());

    <h3 id="class-istypeof">3.3 The isTypeOf operator</h3> 
    The `isTypeOf` operator is a function/method present in any instance of a class defined by jOOPL. 

    It evaluates if an instance is of type of some given class. An interesting point is `isTypeOf` evaluates
    either if the instance is of type of the most derived class or it can check if an instance is of type of
    a given base class (polymorphism).

    For example, if there is a class `A`, `B` and `C`, and `C` inherits `B` and `B` inherits `A`:

        var instanceOfC = new C();

        var isType = instanceOfC.isTypeOf(A); // Evals true!
        isType = instanceOfC.isTypeOf(B); // Evals true!
        isType = instanceOfC.isTypeOf(C); // Evals true!

        var instanceOfA = new A();

        isType = instanceOfA.isTypeOf(C); // Evals false - A is not C!
        isType = instanceOfA.isTypeOf(B); // Evals false - A is not B!
        isType = instanceOfA.isTypeOf(A); // Evals true!

    @class $def
    @static
    */
    $def = function (args) {
        var classDef = null;

        if (args.$inmutable === true && Object.freeze) {
            classDef = function (args, callConstructor) {
                TypeUtil.buildObject(this, args, callConstructor === undefined);

                Object.freeze(this);
            };

        } else if (args.$dynamic === false && Object.preventExtensions) {
            classDef = function (args, callConstructor) {
                TypeUtil.buildObject(this, args, callConstructor === undefined);

                Object.preventExtensions(this);
            };

        } else {
            classDef = function (args, callConstructor) {
                TypeUtil.buildObject(this, args, callConstructor === undefined);
            };
        }

        if (args.$extends) {
            TypeUtil.buildInheritance(classDef, args.$extends);
            classDef.prototype.$base = args.$extends;
        } else {
            classDef.prototype = new $global.joopl.Object();
        }

        if (args.$constructor) {
            classDef.prototype.$ctor = args.$constructor;
        } else {
            classDef.prototype.$ctor = function () { };
        }

        if (args.$members) {
            var propertyDescriptor = null;

            for (var memberName in args.$members) {
                propertyDescriptor = Object.getOwnPropertyDescriptor(args.$members, memberName);

                if (typeof propertyDescriptor.value == "function") {
                    classDef.prototype[memberName] = args.$members[memberName];
                } else if (memberName == "$events" && typeof propertyDescriptor.value == "object") {
                    for (var eventIndex in propertyDescriptor.value) {
                        TypeUtil.createEvent(classDef.prototype, propertyDescriptor.value[eventIndex]);
                    }

                } else if (!propertyDescriptor.value) {
                    TypeUtil.createPropertyFromDescriptor(classDef, memberName, propertyDescriptor);
                }
            }
        }

        if (args.$implements) {
            var result = null;

            if (typeof args.$implements != "Array") {
                result = $interface.implementz(classDef, args.$implements);

                if (!interfaceResultTuple.success) {
                    throw new $global.joopl.NotImplementedException({ memberName: result.memberName });
                }
            }
            else {
                for (var someInterface in args.$implements) {
                    result = $interface.implementz(classDef, args.$implements[someInterface]);

                    if (!result.success) {
                        throw new $global.joopl.NotImplementedException({ memberName: result.memberName });
                    }
                }
            }
        }

        return classDef;
    };

    Object.freeze($def);

    $namespace.register("joopl", function () {
        var scope = this;

        this.Object = function () {
        };

        this.Object.prototype = {
            get joopl() { return version; },
            get typeKind() { return "class"; },

            isTypeOf: function (type) {
                var allBases = [];
                var lastBase = this;
                var isMember = false;

                if (this instanceof type) {
                    isMember = true;
                } else {
                    while (!isMember && lastBase.$base) {
                        if (!(isMember = lastBase.$base instanceof type)) {
                            lastBase = lastBase.$base;
                        }
                    }
                }

                return isMember;
            }
        };

        this.EventManager = $def({
            $constructor: function (args) {
                this.$_.source = args.source;
            },
            $members: {
                get source() {
                    return this.$_.source;
                },

                raiseHandlers: function (source, delegates, args, context) {
                    var current = null;
                    var currentType = null;

                    for (var delegateIndex in delegates) {
                        current = delegates[delegateIndex];
                        currentType = typeof current;

                        switch (currentType) {
                            case "function":
                                current.bind(context ? context : source)(args ? args : null);
                                break;

                            case "object":
                                var func = current.handler;
                                func.bind(current.context ? current.context : (context ? context : source))(args ? args.args : null);
                                break;
                        }
                    }
                },

                register: function (eventName) {
                    var delegates = [];
                    var that = this;
                    var source = this.source;

                    Object.defineProperty(
                        this,
                        eventName, {
                            get: function () {
                                return function (args, context) {
                                    return that.raiseHandlers(this, delegates, args, context);
                                }
                            },
                            set: function (delegateFunc) {
                                var index = delegates.indexOf(delegateFunc);

                                if (index == -1) {
                                    delegates.push(delegateFunc);
                                } else {
                                    delegates.splice(index, 1);
                                }
                            },
                            configurable: false,
                            enumerable: false
                        }
                    );
                }
            },
        });

        this.Exception = $def({
            $constructor: function (args) {
                this.$_.message = args.message;
                this.$_.innerException = args.innerException;
            },

            $members:
            {
                get message() {
                    return this.$_.message;
                },

                get innerException() {
                    return this.$_.innerException;
                },

                toString: function () {
                    return this.message;
                }
            }
        });

        this.ArgumentException = $def({
            $extends: this.Exception,
            $constructor: function (args) {
                this.$_.argName = args.argName;

                var message = "The given argument '" + args.argName + "' is not valid";

                if (args.reason) {
                    message += " (Reason: " + args.reason + ")";
                }

                this.$base.$ctor({
                    message: message
                });
            },
            $members: {
                get argName() {
                    return this.$_.argName;
                }
            }
        });

        this.NotImplementedException = $def({
            $extends: this.Exception,
            $constructor: function (args) {
                this.$base.$ctor(
                    {
                        message: !TypeUtil.hasValue(args) || !TypeUtil.hasValue(args.memberName) ?
                                        "A method or property is not implemented"
                                        :
                                        "Method or property '" + args.memberName + "' is not implemented"
                    }
                );

                this.$_.memberName = args.memberName;
            },
            $members: {
                get memberName() {
                    return this.$_.memberName;
                }
            }
        });
    });
})(undefined);